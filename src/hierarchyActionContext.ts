import { createContext, useContext } from "react";

export const HierarchyActionColumnsContext = createContext(1);
export const useHierarchyActionColumns = () => useContext(HierarchyActionColumnsContext);
