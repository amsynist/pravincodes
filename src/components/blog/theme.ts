/** Syntax colours drawn from the site palette: signal blue keywords, mint strings, ember numbers. */
export const notesTheme = {
  name: "notes",
  type: "dark",
  colors: { "editor.background": "#0a0c12", "editor.foreground": "#d9dfeb" },
  tokenColors: [
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "#5f6675", fontStyle: "italic" } },
    { scope: ["keyword", "storage", "storage.type", "keyword.control", "keyword.operator.new"], settings: { foreground: "#6fa8ff" } },
    { scope: ["string", "string.quoted", "markup.inline.raw"], settings: { foreground: "#9fd9c3" } },
    { scope: ["constant.numeric", "constant.language", "constant.character"], settings: { foreground: "#e3b48f" } },
    { scope: ["entity.name.function", "support.function", "meta.function-call"], settings: { foreground: "#f2f5fb" } },
    { scope: ["variable.parameter", "variable.other.readwrite", "meta.parameter"], settings: { foreground: "#c9d3e6" } },
    { scope: ["entity.name.type", "support.type", "support.class", "entity.name.class"], settings: { foreground: "#b8c9ff" } },
    { scope: ["variable.other.property", "meta.object-literal.key", "support.type.property-name"], settings: { foreground: "#a9c7ff" } },
    { scope: ["punctuation", "meta.brace", "keyword.operator"], settings: { foreground: "#8a91a3" } },
    { scope: ["entity.name.command", "support.function.builtin.shell"], settings: { foreground: "#f2f5fb" } },
    { scope: ["variable.other.normal.shell", "variable.other.special.shell", "punctuation.definition.variable.shell"], settings: { foreground: "#e3b48f" } },
    { scope: ["constant.other.option", "variable.parameter.option"], settings: { foreground: "#8fb7ff" } },
    { scope: ["entity.name.tag"], settings: { foreground: "#6fa8ff" } },
    { scope: ["entity.other.attribute-name"], settings: { foreground: "#a9c7ff" } },
  ],
};
