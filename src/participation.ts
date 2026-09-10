import type { VirtualLayerDefinition, VirtualLayerState } from "./virtualLayers.ts";
import { canonicalVirtualLayerIdentity, formatVirtualLayerPath, guardianVirtualLayerPath, parseVirtualLayerPath, type StatefulVirtualLayerSegment, type VirtualLayerPath } from "./virtualLayerName.ts";

export interface ResolvedLogicalVirtualLayer {
  id: string;
  name: string;
  definitions: VirtualLayerDefinition[];
  guardianId?: string;
  stateGroupId?: string;
  stateGroupName?: string;
  stateName?: string;
}

export interface ResolvedStateGroup {
  id: string;
  name: string;
  guardianId?: string;
  states: Array<{ id: string; name: string; layers: VirtualLayerDefinition[] }>;
}

export type SuppressionReason = "unselected" | "guardian-suppressed" | "guardian-missing";

export interface VirtualLayerParticipation {
  participating: boolean;
  locallySelected?: boolean;
  guardianParticipating: boolean;
  reasons: SuppressionReason[];
}

export interface ResolvedParticipationModel {
  logicalLayers: ResolvedLogicalVirtualLayer[];
  stateGroups: ResolvedStateGroup[];
  byDefinitionId: Map<string, VirtualLayerParticipation>;
  byLogicalId: Map<string, VirtualLayerParticipation>;
}

function stateGroupId(path: VirtualLayerPath, stateful: StatefulVirtualLayerSegment) {
  const parent = guardianVirtualLayerPath(path);
  const prefix = parent ? `${canonicalVirtualLayerIdentity(formatVirtualLayerPath(parent))}/` : "";
  return `${prefix}${stateful.group.toLocaleLowerCase()}`;
}

export function resolveParticipationModel(state: VirtualLayerState): ResolvedParticipationModel {
  const logicalById = new Map<string, ResolvedLogicalVirtualLayer>();
  for (const definition of state.layers) {
    const path = parseVirtualLayerPath(definition.name);
    const id = path && canonicalVirtualLayerIdentity(definition.name);
    if (!path || !id) continue;
    const guardian = guardianVirtualLayerPath(path);
    const final = path.segments[path.segments.length - 1];
    let logical = logicalById.get(id);
    if (!logical) {
      logical = {
        id,
        name: formatVirtualLayerPath(path),
        definitions: [],
        ...(guardian ? { guardianId: canonicalVirtualLayerIdentity(formatVirtualLayerPath(guardian)) } : {}),
        ...(final.kind === "state" ? {
          stateGroupId: stateGroupId(path, final),
          stateGroupName: final.group,
          stateName: final.state,
        } : {}),
      };
      logicalById.set(id, logical);
    }
    logical.definitions.push(definition);
  }

  const groups = new Map<string, ResolvedStateGroup>();
  for (const logical of logicalById.values()) {
    if (!logical.stateGroupId || !logical.stateGroupName || !logical.stateName) continue;
    let group = groups.get(logical.stateGroupId);
    if (!group) {
      group = { id: logical.stateGroupId, name: logical.stateGroupName,
        ...(logical.guardianId ? { guardianId: logical.guardianId } : {}), states: [] };
      groups.set(group.id, group);
    }
    group.states.push({ id: logical.id, name: logical.stateName, layers: logical.definitions });
  }
  for (const group of groups.values()) {
    const order = state.stateOrders?.[group.id] ?? [];
    const positions = new Map(order.map((name, index) => [name.toLocaleLowerCase(), index]));
    group.states = group.states.map((entry, index) => ({ entry, index }))
      .sort((a, b) => (positions.get(a.entry.name.toLocaleLowerCase()) ?? order.length + a.index) -
        (positions.get(b.entry.name.toLocaleLowerCase()) ?? order.length + b.index))
      .map(({ entry }) => entry);
  }

  const byLogicalId = new Map<string, VirtualLayerParticipation>();
  const resolve = (logical: ResolvedLogicalVirtualLayer): VirtualLayerParticipation => {
    const cached = byLogicalId.get(logical.id);
    if (cached) return cached;
    const selected = logical.stateGroupId && logical.stateName
      ? state.stateSelections?.[logical.stateGroupId] === logical.stateName.toLocaleLowerCase()
      : undefined;
    const guardian = logical.guardianId ? logicalById.get(logical.guardianId) : undefined;
    const guardianParticipation = guardian ? resolve(guardian) : undefined;
    const guardianParticipating = logical.guardianId ? guardianParticipation?.participating === true : true;
    const reasons: SuppressionReason[] = [];
    if (selected === false) reasons.push("unselected");
    if (logical.guardianId && !guardian) reasons.push("guardian-missing");
    else if (logical.guardianId && !guardianParticipating) reasons.push("guardian-suppressed");
    const participation = {
      participating: selected !== false && guardianParticipating,
      ...(selected !== undefined ? { locallySelected: selected } : {}),
      guardianParticipating,
      reasons,
    };
    byLogicalId.set(logical.id, participation);
    return participation;
  };

  for (const logical of logicalById.values()) resolve(logical);
  const byDefinitionId = new Map<string, VirtualLayerParticipation>();
  for (const logical of logicalById.values()) {
    const participation = byLogicalId.get(logical.id)!;
    for (const definition of logical.definitions) byDefinitionId.set(definition.id, participation);
  }
  const groupOrder = state.stateGroupOrder ?? [];
  const groupPositions = new Map(groupOrder.map((id, index) => [id, index]));
  const stateGroups = [...groups.values()].map((entry, index) => ({ entry, index }))
    .sort((a, b) => (groupPositions.get(a.entry.id) ?? groupOrder.length + a.index) - (groupPositions.get(b.entry.id) ?? groupOrder.length + b.index))
    .map(({ entry }) => entry);
  return { logicalLayers: [...logicalById.values()], stateGroups, byDefinitionId, byLogicalId };
}

export function withStateGroupSelection(state: VirtualLayerState, groupId: string, stateName: string | null): VirtualLayerState {
  const normalizedGroup = groupId.trim().toLocaleLowerCase();
  if (!normalizedGroup) return state;
  return { ...state, stateSelections: {
    ...state.stateSelections,
    [normalizedGroup]: stateName === null ? null : stateName.trim().toLocaleLowerCase(),
  } };
}

export function reorderResolvedStateGroup(state: VirtualLayerState, groupId: string, activeState: string, overState: string): VirtualLayerState {
  const group = resolveParticipationModel(state).stateGroups.find((entry) => entry.id === groupId.toLocaleLowerCase());
  if (!group) return state;
  const order = group.states.map((entry) => entry.name.toLocaleLowerCase());
  const from = order.indexOf(activeState.trim().toLocaleLowerCase());
  const to = order.indexOf(overState.trim().toLocaleLowerCase());
  if (from < 0 || to < 0 || from === to) return state;
  order.splice(to, 0, order.splice(from, 1)[0]);
  return { ...state, stateOrders: { ...state.stateOrders, [group.id]: order } };
}

export function reorderResolvedStateGroups(state: VirtualLayerState, activeGroupId: string, overGroupId: string): VirtualLayerState {
  const order = resolveParticipationModel(state).stateGroups.map((group) => group.id);
  const from = order.indexOf(activeGroupId.trim().toLocaleLowerCase());
  const to = order.indexOf(overGroupId.trim().toLocaleLowerCase());
  if (from < 0 || to < 0 || from === to) return state;
  order.splice(to, 0, order.splice(from, 1)[0]);
  return { ...state, stateGroupOrder: order };
}

export function participationDescription(participation: VirtualLayerParticipation) {
  if (participation.participating) return "Participating";
  if (participation.reasons.includes("guardian-missing")) return "Suppressed — guardian layer is missing";
  if (participation.reasons.includes("guardian-suppressed")) return "Suppressed — guardian is not participating";
  return "Suppressed — state is unselected";
}
