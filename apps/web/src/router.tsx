import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { routeTree } from "./routeTree.gen";
import { InlineError, isAbortError } from "./components/app/InlineError";

export const getRouter = () => {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Une requête annulée volontairement (navigation, déconnexion) n'est pas une erreur.
        if (isAbortError(error) || typeof window === "undefined") return;
        // N'affiche le message que si des données sont déjà présentes (sinon la page gère l'état vide).
        toast.error("Échec du chargement", {
          id: `q-${query.queryHash}`,
          description: "Certaines données n'ont pas pu être actualisées.",
          action: {
            label: "Réessayer",
            onClick: () => void queryClient.refetchQueries({ queryKey: query.queryKey }),
          },
        });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        if (isAbortError(error) || typeof window === "undefined") return;
        console.error(error);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: (count, error) => !isAbortError(error) && count < 2,
        retryDelay: (n) => Math.min(1000 * 2 ** n, 5000),
        throwOnError: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Les erreurs de route s'affichent dans la zone de contenu, pas en plein écran.
    defaultErrorComponent: ({ error, reset }) => <InlineError error={error} reset={reset} />,
  });

  return router;
};
