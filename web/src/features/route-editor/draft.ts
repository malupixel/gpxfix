import { createEditorState, type RouteEditorDocument } from "./model";
export const DRAFT_KEY = "route-community.route-editor.v1";
export function saveDraft(document: RouteEditorDocument) { localStorage.setItem(DRAFT_KEY, JSON.stringify(document)); }
export function loadDraft(): RouteEditorDocument | null { try { const value=JSON.parse(localStorage.getItem(DRAFT_KEY)??"null"); return value?.version===1&&Array.isArray(value.points)&&Array.isArray(value.segments)?value:null; } catch { return null; } }
export function clearDraft(){localStorage.removeItem(DRAFT_KEY);}
export { createEditorState };
