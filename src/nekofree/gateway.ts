/**
 * NekoFree Gateway utilities
 *
 * Thin facade над src/utils/cch.ts.
 * Вся логика CCH signing живёт в legacy, но этот файл —
 * чистый entry point для nekofree-зоны.
 */

export {
	computeCch,
	replaceCchPlaceholder,
	hasCchPlaceholder,
} from "../utils/cch.js"
