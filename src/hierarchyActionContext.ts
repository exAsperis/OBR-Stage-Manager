import { createContext, useContext } from "react";

export interface HierarchyActionLayoutValue { columns: number; slotSize: number; labelWidth: number }
export const HierarchyActionColumnsContext = createContext<HierarchyActionLayoutValue>({ columns: 1, slotSize: 30, labelWidth: 228 });
export const useHierarchyActionLayout = () => useContext(HierarchyActionColumnsContext);
export const useHierarchyActionColumns = () => useHierarchyActionLayout().columns;
