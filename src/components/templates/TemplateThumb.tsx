import { Composition } from "@/lib/render/Composition";
import { defaultFields } from "@/lib/fields";
import type { RenderInput, TemplateDefinition } from "@/types";

type Props = {
  template: TemplateDefinition;
  eventType?: RenderInput["eventType"];
  cardType?: RenderInput["cardType"];
  className?: string;
};

export function TemplateThumb({ template, eventType, cardType, className }: Props) {
  const input: RenderInput = {
    schemaVersion: 1,
    kind: template.kind,
    eventType,
    cardType,
    templateId: template.id,
    fields: defaultFields(template, { eventType, cardType }),
    theme: "classic",
  };

  return (
    <div className={className ?? "overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-card"}>
      <div className="aspect-[1080/1512] bg-cream-dark">
        <Composition template={template} input={input} />
      </div>
    </div>
  );
}
