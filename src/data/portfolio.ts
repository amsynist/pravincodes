import { resumeData } from "./resume";

/**
 * Contact details — replace the placeholders below with real values.
 * (They are not in resume.ts, so nothing here has been invented.)
 */
export const contact = {
  email: "pravinblogging@gmail.com",
  availability: "Open to AI product & platform work",
  links: [
    { label: "GitHub", href: "#" }, // TODO
    { label: "LinkedIn", href: "#" }, // TODO
    { label: "X", href: "#" }, // TODO
  ],
};

export const identity = {
  first: "Praveen",
  role: "AI full-stack engineer",
  years: resumeData.experience,
};

export const capabilityGroups = [
  {
    key: "intelligence",
    name: "Intelligence",
    line: "LLM agents, retrieval and voice — models wired into products that answer back.",
    items: resumeData.skills.ai,
  },
  {
    key: "interfaces",
    name: "Services",
    line: "Fast APIs and the interfaces on top of them, from Go microservices to Next.js.",
    items: resumeData.skills.web,
  },
  {
    key: "data",
    name: "Data",
    line: "ETL pipelines, media processing and the stores that make embeddings useful.",
    items: [...resumeData.skills.databases.filter((d) => !["Weaviate", "Pinecone"].includes(d)), "ETL Pipelines", "Media Processing"],
  },
  {
    key: "infra",
    name: "Cloud",
    line: "Infrastructure as code, containers and serverless — shipped, observable, repeatable.",
    items: ["Docker", "Kubernetes", "Terraform", "CI/CD", "AWS Lambda", "Step Functions", "GCP", "Serverless", "Microservices"],
  },
];

export const languages = ["Python", "Go", "TypeScript", "JavaScript", "Lua", "Bash", "GraphQL", "HTML5", "CSS3"];

export const projects = resumeData.projects;

export const industries = Array.from(new Set(resumeData.projects.map((p) => p.industry.split(" / ")[0])));
