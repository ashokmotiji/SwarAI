import { describe, it, expect, vi } from "vitest";
import { extractOrderValue } from "@/lib/ai-analysis";

vi.mock("openai", () => {
  return {
    OpenAI: vi.fn().mockImplementation(function() {
      return {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: "500.50" } }]
            })
          }
        }
      };
    })
  };
});

describe("AI Analysis", () => {
  it("extracts order value", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const val = await extractOrderValue("The customer ordered items worth 500.50");
    expect(val).toBe(500.50);
  });
});
