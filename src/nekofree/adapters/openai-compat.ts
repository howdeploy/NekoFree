/**
 * OpenAI-compatible adapter facade
 *
 * Thin re-export of src/services/api/openai-chat-fetch-adapter.ts.
 * This lets nekofree-zone code depend on a stable interface
 * even if the legacy file moves or changes.
 */

export {
	createOpenAIChatFetch,
} from "../../services/api/openai-chat-fetch-adapter.js"

/** Options for createOpenAIChatFetch */
export type OpenAIChatFetchOptions = {
	stripImages?: boolean
}
