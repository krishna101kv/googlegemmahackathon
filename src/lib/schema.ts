import { z } from "zod";

export const rubricScoresSchema = z.object({
  clarity: z.number().min(1).max(5),
  pace: z.number().min(1).max(5),
  fillerControl: z.number().min(1).max(5),
  structure: z.number().min(1).max(5),
  confidence: z.number().min(1).max(5),
  vocalVariety: z.number().min(1).max(5),
});

export const improvementAreaSchema = z.object({
  area: z.string().min(1),
  evidence: z.string().min(1),
  suggestion: z.string().min(1),
});

export const coachEvaluationSchema = z.object({
  transcript: z.string().min(1),
  overallScore: z.number().min(0).max(100),
  scores: rubricScoresSchema,
  strengths: z.array(z.string()).min(1).max(6),
  improvementAreas: z.array(improvementAreaSchema).min(1).max(6),
  drills: z.array(z.string()).min(1).max(5),
  nextFocusArea: z.string().min(1),
  transcriptionConfidence: z.enum(["high", "medium", "low"]),
});

export type CoachEvaluationParsed = z.infer<typeof coachEvaluationSchema>;

/** JSON Schema for Ollama native structured output / format enforcement */
export const ollamaFormatSchema = {
  type: "object",
  required: [
    "transcript",
    "overallScore",
    "scores",
    "strengths",
    "improvementAreas",
    "drills",
    "nextFocusArea",
    "transcriptionConfidence",
  ],
  properties: {
    transcript: {
      type: "string",
      description: "Full verbatim transcript of the speech audio",
    },
    overallScore: {
      type: "number",
      description: "Overall delivery score from 0 to 100",
    },
    scores: {
      type: "object",
      required: [
        "clarity",
        "pace",
        "fillerControl",
        "structure",
        "confidence",
        "vocalVariety",
      ],
      properties: {
        clarity: { type: "number", minimum: 1, maximum: 5 },
        pace: { type: "number", minimum: 1, maximum: 5 },
        fillerControl: { type: "number", minimum: 1, maximum: 5 },
        structure: { type: "number", minimum: 1, maximum: 5 },
        confidence: { type: "number", minimum: 1, maximum: 5 },
        vocalVariety: { type: "number", minimum: 1, maximum: 5 },
      },
    },
    strengths: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 6,
    },
    improvementAreas: {
      type: "array",
      items: {
        type: "object",
        required: ["area", "evidence", "suggestion"],
        properties: {
          area: { type: "string" },
          evidence: { type: "string" },
          suggestion: { type: "string" },
        },
      },
      minItems: 1,
      maxItems: 6,
    },
    drills: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 5,
    },
    nextFocusArea: { type: "string" },
    transcriptionConfidence: {
      type: "string",
      enum: ["high", "medium", "low"],
    },
  },
} as const;
