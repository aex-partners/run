import { FlowCanvas } from "../../organisms/FlowEditor/FlowCanvas";
import { StepSettingsSidebar } from "../../organisms/FlowEditor/StepSettingsSidebar";
import { FlowToolbar, type FlowToolbarProps } from "../../organisms/FlowEditor/FlowToolbar";
import { useFlowBuilderStore } from "../../../stores/flow-builder-store";

export type FlowEditorScreenProps = FlowToolbarProps;

export function FlowEditorScreen(props: FlowEditorScreenProps) {
  const flowVersion = useFlowBuilderStore((s) => s.flowVersion);
  const rightSidebar = useFlowBuilderStore((s) => s.rightSidebar);

  if (!flowVersion) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
        Loading flow...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <FlowToolbar {...props} />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <FlowCanvas />
        </div>
        {rightSidebar === "settings" && <StepSettingsSidebar />}
      </div>
    </div>
  );
}
