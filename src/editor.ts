import { NodeEditor, GetSchemes, ClassicPreset } from "rete";
import { AreaPlugin, AreaExtensions } from "rete-area-plugin";
import {
  ConnectionPlugin,
  Presets as ConnectionPresets,
  getSourceTarget,
  ClassicFlow
} from "rete-connection-plugin";
import { VuePlugin, Presets, VueArea2D } from "rete-vue-plugin";
import { invoke } from "@tauri-apps/api/core";

async function createConnection(portName: string) {
  // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
  await invoke("create_connection", { portName: portName });
}

type Schemes = GetSchemes<
  ClassicPreset.Node,
  ClassicPreset.Connection<ClassicPreset.Node, ClassicPreset.Node>
>;
type AreaExtra = VueArea2D<Schemes>;

const socket = new ClassicPreset.Socket("socket");

class SourceNode extends ClassicPreset.Node<
  {},
  { value: ClassicPreset.Socket },
  { value: ClassicPreset.InputControl<"number"> }
> {
  height = 120;
  width = 180;

  constructor(initial: number, change?: () => void) {
    super("Source");
    this.addOutput("value", new ClassicPreset.Output(socket, "Source"));
  }
}

class AddNode extends ClassicPreset.Node<
  { left: ClassicPreset.Socket; right: ClassicPreset.Socket },
  { value: ClassicPreset.Socket },
  { value: ClassicPreset.InputControl<"number"> }
> {
  height = 190;
  width = 180;

  constructor(
    change?: () => void,
    private update?: (control: ClassicPreset.InputControl<"number">) => void
  ) {
    super("Add");
    const left = new ClassicPreset.Input(socket, "Left");
    const right = new ClassicPreset.Input(socket, "Right");

    left.addControl(
      new ClassicPreset.InputControl("number", { initial: 0, change })
    );
    right.addControl(
      new ClassicPreset.InputControl("number", { initial: 0, change })
    );

    this.addInput("left", left);
    this.addInput("right", right);
    this.addControl(
      "value",
      new ClassicPreset.InputControl("number", {
        readonly: true
      })
    );
    this.addOutput("value", new ClassicPreset.Output(socket, "Number"));
  }

  data(inputs: { left?: number[]; right?: number[] }): { value: number } {
    const leftControl = this.inputs.left?.control as ClassicPreset.InputControl<
      "number"
    >;
    const rightControl = this.inputs.right
      ?.control as ClassicPreset.InputControl<"number">;

    const { left, right } = inputs;
    const value =
      (left ? left[0] : leftControl.value || 0) +
      (right ? right[0] : rightControl.value || 0);

    this.controls.value.setValue(value);

    if (this.update) this.update(this.controls.value);

    return { value };
  }
}

class SinkNode extends ClassicPreset.Node<
  { left: ClassicPreset.Socket }
> {
  height = 120;
  width = 180;

  constructor(
    change?: () => void,
    private update?: (control: ClassicPreset.InputControl<"number">) => void
  ) {
    super("Sink");
    const left = new ClassicPreset.Input(socket, "In");

    this.addInput("left", left);
  }
}

export async function createEditor(container: HTMLElement) {
  const socket = new ClassicPreset.Socket("socket");

  const editor = new NodeEditor<Schemes>();
  const area = new AreaPlugin<Schemes, AreaExtra>(container);
  const connection = new ConnectionPlugin<Schemes, AreaExtra>();
  const render = new VuePlugin<Schemes, AreaExtra>();

  AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
    accumulating: AreaExtensions.accumulateOnCtrl()
  });

  render.addPreset(Presets.classic.setup());

  connection.addPreset(() => new ClassicFlow({
    makeConnection(from, to, context) {
      const [source, target] = getSourceTarget(from, to) || [null, null];
      const { editor } = context;

      if (source && target) {
        console.debug("Adding connection", source, target);
        editor.addConnection(new ClassicPreset.Connection(
          editor.getNode(source.nodeId) ?? (() => { throw new Error(`Node with id ${source.nodeId} not found`); })(),
          source.key,
          editor.getNode(target.nodeId) ?? (() => { throw new Error(`Node with id ${target.nodeId} not found`); })(),
          target.key
        ));

        let port_name = "Test: " + source.nodeId + " -> " + target.nodeId;
        if (source.key && target.key) {
          port_name += ` (${source.key} -> ${target.key})`;
        }

        createConnection(port_name).catch(console.error);

        return true;
      }
    }
  }))

  editor.use(area);
  area.use(connection);
  area.use(render);

  AreaExtensions.simpleNodesOrder(area);

  const a = new SourceNode(2);
  await editor.addNode(a);

  const b = new SourceNode(42);
  await editor.addNode(b);

  const c = new SinkNode();
  await editor.addNode(c);

  await area.translate(b.id, { x: 320, y: 0 });

  //await editor.addConnection(new ClassicPreset.Connection(a, "a", b, "b"));

  AreaExtensions.zoomAt(area, editor.getNodes());

  return () => area.destroy();
}
