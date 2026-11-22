/** The project's own repository, used for the landing page's live strip. Kept free of heavy imports. */
export const DEMO_REPO = (import.meta.env.VITE_DEMO_REPO || 'SamuelDharshi/Bond').split('/') as [string, string];
