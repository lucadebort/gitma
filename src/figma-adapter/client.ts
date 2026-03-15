/**
 * Figma client — wraps the Figma REST API for component and variable reads.
 *
 * The MCP server is used by the AI agent at design-to-code time.
 * This client is for the CLI's direct reads — it calls the Figma REST API
 * to get component definitions and variables without needing MCP.
 */

import type {
  FigmaComponent,
  FigmaComponentSet,
  FigmaVariable,
  FigmaVariableCollection,
  FigmaAdapterConfig,
  FigmaComponentProperty,
} from "./types.js";

const FIGMA_API_BASE = "https://api.figma.com/v1";

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function getToken(config: FigmaAdapterConfig): string {
  const token = config.accessToken ?? process.env.FIGMA_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "Figma access token not found. Set FIGMA_ACCESS_TOKEN env var or pass accessToken in config.",
    );
  }
  return token;
}

async function figmaFetch<T>(
  path: string,
  token: string,
): Promise<T> {
  const url = `${FIGMA_API_BASE}${path}`;
  const response = await fetch(url, {
    headers: { "X-FIGMA-TOKEN": token },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Figma API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API response types (raw Figma shapes)
// ---------------------------------------------------------------------------

interface FigmaFileComponentsResponse {
  meta: {
    components: Array<{
      key: string;
      name: string;
      description: string;
      node_id: string;
      component_set_id: string | null;
      containing_frame: { nodeId: string; name: string };
    }>;
    component_sets: Array<{
      key: string;
      name: string;
      description: string;
      node_id: string;
    }>;
  };
}

interface FigmaFileNodesResponse {
  nodes: Record<
    string,
    {
      document: {
        id: string;
        name: string;
        type: string;
        componentPropertyDefinitions?: Record<string, FigmaComponentProperty>;
        children?: Array<{
          id: string;
          name: string;
          type: string;
          componentPropertyDefinitions?: Record<string, FigmaComponentProperty>;
        }>;
      };
    }
  >;
}

interface FigmaVariablesResponse {
  meta: {
    variables: Record<string, {
      id: string;
      name: string;
      key: string;
      resolvedType: "BOOLEAN" | "FLOAT" | "STRING" | "COLOR";
      description: string;
      valuesByMode: Record<string, unknown>;
      variableCollectionId: string;
    }>;
    variableCollections: Record<string, {
      id: string;
      name: string;
      key: string;
      modes: Array<{ modeId: string; name: string }>;
      variableIds: string[];
    }>;
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all components and component sets from a Figma file.
 */
export async function fetchComponents(
  config: FigmaAdapterConfig,
): Promise<{ componentSets: FigmaComponentSet[]; components: FigmaComponent[] }> {
  const token = getToken(config);
  const { fileKey } = config;

  // Get file components metadata
  const meta = await figmaFetch<FigmaFileComponentsResponse>(
    `/files/${fileKey}/components`,
    token,
  );

  const components: FigmaComponent[] = meta.meta.components.map((c) => ({
    key: c.key,
    name: c.name,
    description: c.description,
    nodeId: c.node_id,
    componentSetId: c.component_set_id ?? undefined,
  }));

  // Get component set node IDs to fetch their property definitions
  const componentSetNodeIds = meta.meta.component_sets.map((cs) => cs.node_id);

  const componentSets: FigmaComponentSet[] = [];

  if (componentSetNodeIds.length > 0) {
    // Fetch nodes in batches of 50 (Figma API limit)
    for (let i = 0; i < componentSetNodeIds.length; i += 50) {
      const batch = componentSetNodeIds.slice(i, i + 50);
      const nodeIds = batch.join(",");

      const nodesResponse = await figmaFetch<FigmaFileNodesResponse>(
        `/files/${fileKey}/nodes?ids=${nodeIds}`,
        token,
      );

      for (const csInfo of meta.meta.component_sets) {
        const nodeData = nodesResponse.nodes[csInfo.node_id];
        if (!nodeData) continue;

        const doc = nodeData.document;
        const variantComponents = components.filter(
          (c) => c.componentSetId === csInfo.key || c.componentSetId === csInfo.node_id,
        );

        componentSets.push({
          key: csInfo.key,
          name: csInfo.name,
          description: csInfo.description,
          nodeId: csInfo.node_id,
          componentPropertyDefinitions: doc.componentPropertyDefinitions ?? {},
          variantComponents,
        });
      }
    }
  }

  return { componentSets, components };
}

/**
 * Fetch all variables and variable collections from a Figma file.
 */
export async function fetchVariables(
  config: FigmaAdapterConfig,
): Promise<{ variables: FigmaVariable[]; collections: FigmaVariableCollection[] }> {
  const token = getToken(config);
  const { fileKey } = config;

  const response = await figmaFetch<FigmaVariablesResponse>(
    `/files/${fileKey}/variables/local`,
    token,
  );

  const variables: FigmaVariable[] = Object.values(response.meta.variables).map((v) => ({
    id: v.id,
    name: v.name,
    key: v.key,
    resolvedType: v.resolvedType,
    description: v.description,
    valuesByMode: v.valuesByMode as Record<string, any>,
    variableCollectionId: v.variableCollectionId,
  }));

  const collections: FigmaVariableCollection[] = Object.values(
    response.meta.variableCollections,
  ).map((c) => ({
    id: c.id,
    name: c.name,
    key: c.key,
    modes: c.modes,
    variableIds: c.variableIds,
  }));

  return { variables, collections };
}
