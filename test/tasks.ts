// Lean Checker Tasks
export const TASKS = {
  Echo: {
    task: "echo",
    input: { data: "String" },
    output: { data: "String" },
    commonly_used: false,
  },
  "Documentation for a Theorem": {
    task: "theorem_doc",
    input: { theorem_name: "String", theorem_statement: "String" },
    output: { theorem_doc: "String" },
    commonly_used: false,
  },
  "Documentation for a Definition": {
    task: "def_doc",
    input: { definition_name: "String", definition_code: "String" },
    output: { definition_doc: "String" },
    commonly_used: false,
  },
  "Translate Theorem": {
    task: "translate_thm",
    input: { theorem_text: "String" },
    output: { theorem_code: "String" },
    parameters: {
      greedy: "Bool (default: true)",
      fallback: "Bool (default: true)",
    },
    commonly_used: false,
  },
  "Translate Definition": {
    task: "translate_def",
    input: { definition_text: "String" },
    output: { definition_code: "String" },
    parameters: { fallback: "Bool (default: true)" },
    commonly_used: false,
  },
  "Theorem Name": {
    task: "theorem_name",
    input: { theorem_text: "String" },
    output: { theorem_name: "String" },
    commonly_used: false,
  },
  Prove: {
    task: "prove",
    input: { theorem_text: "String" },
    output: { proof_text: "String" },
    commonly_used: false,
  },
  "Translate Theorem Detailed": {
    task: "translate_thm_detailed",
    input: { theorem_text: "String" },
    output: {
      theorem_code: "String",
      theorem_name: "String",
      proved: "Bool",
      theorem_statement: "String",
      definitions_used: "String",
    },
    parameters: {
      greedy: "Bool (default: true)",
      fallback: "Bool (default: true)",
    },
    commonly_used: false,
  },
  "Structured JSON Proof": {
    task: "structured_json_proof",
    input: { theorem_text: "String", proof_text: "String" },
    output: { document_json: "Json" },
    commonly_used: false,
  },
  "Elaborate Lean Code": {
    task: "elaborate",
    input: { document_code: "String", declarations: "List Name" },
    output: { logs: "List String", sorries: "List Json" },
    parameters: {
      top_code: 'String (default: "")',
      describe_sorries: "Bool (default: false)",
    },
    commonly_used: false,
  },
  "Lean from JSON Structured": {
    task: "lean_from_json_structured",
    input: { document_json: "Json" },
    output: {
      document_code: "String",
      declarations: "List String",
      top_code: "String",
    },
    commonly_used: false,
  },
};
