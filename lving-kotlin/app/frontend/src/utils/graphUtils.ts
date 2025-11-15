// Graph visualization utility functions

import type { DataSet, Network } from "vis-network";
import axios from "axios";

export interface GraphNode {
  id: string;
  label: string;
  labels: string[];
  title: Record<string, string>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  title: Record<string, string>;
}

// Extract a meaningful display name from node properties
export function getNodeDisplayName(node: GraphNode): string {
  const MAX_LABEL_LENGTH = 20; // Truncate all labels to this length
  
  let displayName = '';

  const refenceLabel = anyIncludes(node.labels, "reference") ? "\n(ref)" : ""
  
  // Priority order: name > fullName > "reference" > code (truncated) > label (type)
  if (node.title.name) {
    displayName = node.title.name + refenceLabel;
  } else if (node.title.fullName) {
    displayName = node.title.fullName + refenceLabel;
  } else if (node.title.code) {
    displayName = node.title.code;
  } else {
    displayName = node.label; // Fall back to node type
  }
  
  // Truncate to max length with ellipsis
  if (displayName.length > MAX_LABEL_LENGTH) {
    return displayName.substring(0, MAX_LABEL_LENGTH) + '...';
  }
  
  return displayName;
}

function anyIncludes(arr: string[], match: string | string[]): boolean {
  const loweredArr = arr.map(e => { return e.toLowerCase(); });
  return loweredArr.some(e => {
    if (typeof match == "string") {
      return e.includes(match);
    }
    return match.some(m => { return e.includes(m); });
  });
}

// Node shape based on type
export function getNodeShape(node: GraphNode): string {
  if (anyIncludes(node.labels, ['function', 'method'])) return 'box';
  if (anyIncludes(node.labels, ['variable', 'declaration'])) return 'circle';
  if (anyIncludes(node.labels, 'operator')) return 'diamond';
  if (anyIncludes(node.labels, 'literal')) return 'triangle';
  if (node.labels.includes('CallExpression')) return 'triangleDown';
  return 'dot'; // default
}

// Node color based on type and properties
export function getNodeColor(node: GraphNode): { background: string; border: string } {
  // Color by node type
  if (anyIncludes(node.labels, ['function', 'method'])) return { background: '#28a745', border: '#fff' };
  if (anyIncludes(node.labels, ['variable', 'declaration'])) return { background: '#007acc', border: '#fff' };
  if (anyIncludes(node.labels, ['reference'])) return { background: '#F57F50', border: '#fff' };
  if (anyIncludes(node.labels, 'operator')) return { background: '#ffc107', border: '#fff' };
  if (anyIncludes(node.labels, 'literal')) return { background: '#6f42c1', border: '#fff' };
  
  // Check for unsafe or risky properties
  const titleString = JSON.stringify(node.title || {}).toLowerCase();
  if (titleString.includes('unsafe') || titleString.includes('*mut') || titleString.includes('raw')) {
    return { background: '#dc3545', border: '#fff' }; // Red for unsafe
  }

  if (titleString.includes('drop')) {
    return { background: '#dc3545', border: '#fff' }; 
  }

  return { background: '#007acc', border: '#fff' }; // Default blue
}

// Edge style based on relationship type
export function getEdgeStyle(edge: GraphEdge): {
  color: { color: string };
  width: number;
  dashes: boolean | number[];
  arrows: { to: { enabled: boolean; scaleFactor: number } };
} {
  const label = edge.label?.toUpperCase() || '';
  
  switch (label) {
    case 'DFG':
      return {
        color: { color: '#28a745' }, // Green for data flow
        width: 2,
        dashes: false,
        arrows: { to: { enabled: true, scaleFactor: 1 } }
      };
    
    case 'EOG':
      return {
        color: { color: '#007acc' }, // Blue for execution order
        width: 3,
        dashes: false,
        arrows: { to: { enabled: true, scaleFactor: 1.2 } }
      };
    
    case 'AST':
      return {
        color: { color: '#6f42c1' }, // Purple for AST structure
        width: 1,
        dashes: false,
        arrows: { to: { enabled: true, scaleFactor: 0.8 } }
      };
    
    case 'REFERS_TO':
      return {
        color: { color: '#ffc107' }, // Yellow for references
        width: 2,
        dashes: [5, 5], // Dashed line
        arrows: { to: { enabled: true, scaleFactor: 1 } }
      };
    
    case 'PDG':
      return {
        color: { color: '#e83e8c' }, // Pink for program dependencies
        width: 2,
        dashes: [10, 5],
        arrows: { to: { enabled: true, scaleFactor: 1.1 } }
      };
    
    case 'USAGE':
      return {
        color: { color: '#fd7e14' }, // Orange for usage
        width: 2,
        dashes: [3, 3],
        arrows: { to: { enabled: true, scaleFactor: 0.9 } }
      };
    
    case 'SCOPE':
      return {
        color: { color: '#20c997' }, // Teal for scope
        width: 1,
        dashes: [8, 4],
        arrows: { to: { enabled: true, scaleFactor: 0.8 } }
      };
    
    default:
      return {
        color: { color: '#fff' }, // Default white
        width: 2,
        dashes: false,
        arrows: { to: { enabled: true, scaleFactor: 1 } }
      };
  }
}

// Create rich tooltip for nodes
export function createNodeTooltip(node: GraphNode): string {
  const keyStyle = `<u style="color: yellow !important;">`;

  // The last 3 labels are the most specific.
  let labelSlice = node.labels.slice(Math.max(node.labels.length - 3, 0), node.labels.length);
  let tooltipText = `${keyStyle}Node:</u> ${labelSlice.join(', ')}\n${keyStyle}ID:</u> ${node.id}`;

  const ignoredProps = ["template", "projectId", "isVariadic", "nameDelimiter", "isImplicit", "isInferred", "referenceTag"];
  const nameProps = ["name", "localName", "fullName"];

  if (node.title && typeof node.title === 'object') {
    var fullName = "";
    Object.entries(node.title).forEach(([key, value]) => {
      if (ignoredProps.includes(key)) return;

      // Remove name, localName, or fullName is the value is empty.
      if (nameProps.includes(key) && value == '') return;

      // Remove localName and name if it is the same as fullName.
      if (["localName", "name"].includes(key) && value == fullName) return;
      if (key == "fullName") { fullName = value; }

      if (key !== 'id' && value !== null && value !== undefined) {
        // Truncate long values
        const valueStr = String(value);
        const displayValue = valueStr.length > 100 ? valueStr.substring(0, 100) + '...' : valueStr;
        tooltipText += `\n<u style="color: yellow !important;">${key}:</u> ${displayValue}`;
      }
    });
  }
  
  return tooltipText;
}

// Create rich tooltip for edges
export function createEdgeTooltip(edge: GraphEdge): string {
  const keyStyle = `<u style="color: yellow !important;">`;
  let tooltipText = `${keyStyle}Relationship:</u> ${edge.label}\n${keyStyle}From:</u> ${edge.from} → ${keyStyle}To:</u> ${edge.to}`;
  
  if (edge.title && typeof edge.title === 'object') {
    Object.entries(edge.title).forEach(([key, value]) => {
      if (key !== 'id' && value !== null && value !== undefined) {
        tooltipText += `\n${keyStyle}${key}:</u> ${value}`;
      }
    });
  }
  
  return tooltipText;
}

// Filter functions
export interface EnabledFilters {
  function: boolean;
  variable: boolean;
  operator: boolean;
  literal: boolean;
  unsafe: boolean;
  other: boolean;
}

export function nodeMatchesSearch(node: GraphNode, searchTerm: string): boolean {
  const lowerSearchTerm = searchTerm.toLowerCase();
  
  // Search in node label
  if (node.label && node.label.toLowerCase().includes(lowerSearchTerm)) {
    return true;
  }
  
  // Search in node ID
  if (node.id && node.id.toString().toLowerCase().includes(lowerSearchTerm)) {
    return true;
  }
  
  // Search in node title (properties)
  if (node.title && typeof node.title === 'object') {
    const titleString = JSON.stringify(node.title).toLowerCase();
    if (titleString.includes(lowerSearchTerm)) {
      return true;
    }
  }
  
  return false;
}

export function nodeMatchesTypeFilter(node: GraphNode, enabledFilters: EnabledFilters): boolean {
  const label = node.label?.toLowerCase() || '';
  
  // Check if node matches any enabled filter
  if (enabledFilters.function && (label.includes('function') || label.includes('method'))) {
    return true;
  }
  
  if (enabledFilters.variable && (label.includes('variable') || label.includes('declaration'))) {
    return true;
  }
  
  if (enabledFilters.operator && label.includes('operator')) {
    return true;
  }
  
  if (enabledFilters.literal && label.includes('literal')) {
    return true;
  }
  
  // Check for unsafe operations
  if (enabledFilters.unsafe) {
    const titleStr = JSON.stringify(node.title || {}).toLowerCase();
    const hasUnsafe = titleStr.includes('unsafe') || titleStr.includes('*mut') || 
                      titleStr.includes('raw') || titleStr.includes('sendable');
    if (hasUnsafe) return true;
  }
  
  // "Other" category for nodes that don't match specific types
  if (enabledFilters.other) {
    const isSpecificType = label.includes('function') || label.includes('method') ||
                          label.includes('variable') || label.includes('declaration') ||
                          label.includes('operator') || label.includes('literal');
    
    if (!isSpecificType) return true;
  }
  
  return false;
}

export function filterGraphData(
  nodes: GraphNode[],
  edges: GraphEdge[],
  searchTerm: string,
  enabledFilters: EnabledFilters
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  // Filter nodes
  const filteredNodes = nodes.filter(node => {
    const matchesSearch = searchTerm === '' || nodeMatchesSearch(node, searchTerm);
    const matchesType = nodeMatchesTypeFilter(node, enabledFilters);
    return matchesSearch && matchesType;
  });
  
  // Get filtered node IDs
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  
  // Filter edges to only show connections between visible nodes
  const filteredEdges = edges.filter(edge => {
    return filteredNodeIds.has(edge.from) && filteredNodeIds.has(edge.to);
  });
  
  return { nodes: filteredNodes, edges: filteredEdges };
}

interface GraphRef {
  nodes: DataSet<GraphNode>,
  edges: DataSet<GraphEdge>,
  projectId: string,
}

export function showContextMenu(
  event: any,
  graph: GraphRef,
  network: Network,
  mode: "node" | "canvas",
) {
  hideContextMenu();
  const nodeId = event.nodes[0];

  const menu = document.createElement('div');
  menu.id = 'node-context-menu';
  menu.style.cssText = `
    position: absolute;
    background: rgba(40, 40, 40, 0.95);
    color: white;
    border: 1px solid #666;
    border-radius: 6px;
    padding: 8px 0;
    font-size: 13px;
    font-family: sans-serif;
    z-index: 2000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    min-width: 160px;
    backdrop-filter: blur(5px);
  `;

  var menuItems: any = []
  if (mode == "node") {
    menuItems = [
      {
        label: `📈 Expand from Database`,
        action: () => expandNodesFromDatabase(graph, nodeId),
        enabled: true,
      },
      // XXX: i dont recall how this differs from expand from db
      // {
      //   label: '👁️ Expand All Connected',
      //   action: () => expandAllConnected(nodeId),
      //   enabled: true
      // },
      {
        label: '🗑️ Remove from View',
        action: () => removeNodeFromView(graph, nodeId),
        enabled: true,
        color: '#dc3545'
      },
      {
        label: '🔍 Focus on Node',
        action: () => focusOnNode(nodeId, network),
        enabled: true
      },
      { separator: true },
      {
        label: `📋 Copy Node ID (${nodeId})`,
        action: () => copyToClipboard(nodeId),
        enabled: true
      },
      // {
      //   label: '🔧 Debug Node Info',
      //   action: () => showNodeDebugInfo(nodeId),
      //   enabled: true,
      //   color: '#17a2b8'
      // }
    ];
  } else if (mode == "canvas") {
    menuItems = [
      {
        label: '🔍 Highlight Tracked Nodes',
        action: () => highlightTrackedNodes(graph),
        enabled: true
      }
    ];
  }

    menuItems.forEach((item: any) => {
    if (item.separator) {
      const separator = document.createElement('div');
      separator.style.cssText = 'height: 1px; background: #666; margin: 4px 8px;';
      menu.appendChild(separator);
    } else {
      const menuItem = document.createElement('div');
      menuItem.style.cssText = `
        padding: 8px 16px;
        cursor: ${item.enabled ? 'pointer' : 'not-allowed'};
        opacity: ${item.enabled ? '1' : '0.5'};
        transition: background-color 0.2s;
        color: ${item.color || 'white'};
      `;
      
      if (item.enabled) {
        menuItem.addEventListener('mouseenter', () => {
          menuItem.style.backgroundColor = 'rgba(70, 70, 70, 0.8)';
        });
        menuItem.addEventListener('mouseleave', () => {
          menuItem.style.backgroundColor = 'transparent';
        });
        menuItem.addEventListener('click', (e) => {
          e.stopPropagation();
          item.action();
          hideContextMenu();
        });
      }
      
      menuItem.textContent = item.label!!;
      menu.appendChild(menuItem);
    }
  });
  
  document.body.appendChild(menu);

  let x = 0, y = 0;
  
  if (event.pointer && event.pointer.DOM) {
    const canvas = event.event.target;
    if (canvas) {
      const bbox = canvas.getBoundingClientRect();
      x = bbox.left + event.pointer.DOM.x + 10;
      y = bbox.top + event.pointer.DOM.y + 10;
    } else {
      x = event.pointer.DOM.x + 10;
      y = event.pointer.DOM.y - 10;
    }
  } else if (event.event && event.event.clientX) {
    x = event.event.clientX + 10;
    y = event.event.clientY - 10;
  } else {
    x = event.clientX + 10;
    y = event.clientY - 10;
  }
  
  x += window.scrollX;
  y += window.scrollY;
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}

export function hideContextMenu() {
  const existing = document.getElementById('node-context-menu');
  if (existing) {
    existing.remove();
  }
}

function removeNodeFromView(graph: GraphRef, nodeId: string) {
  graph.nodes.remove(nodeId);
  showTemporaryMessage(`Removed node ${nodeId} from view`);
}

async function expandNodesFromDatabase(graph: GraphRef, nodeId: string) {
  const query = `
    MATCH (n) 
    WHERE id(n) = ${nodeId}
    CALL apoc.path.expandConfig(n, {
        relationshipFilter: 'DFG|EOG|AST|REFERS_TO|PDG|USAGE|SCOPE',
        minLevel: 1,
        maxLevel: 1,
        bfs: false,
        uniqueness: 'RELATIONSHIP_GLOBAL'
    })
    YIELD path
    WITH DISTINCT path
    RETURN path
  `

  var data;
  try {
    const response = await axios.post(`/projects/${graph.projectId}/query`, { query });
    data = response.data;
  } catch {
    showTemporaryMessage(`An error occurred when querying connecting edges for node ${nodeId}.`);
    return;
  }

  if (!data.edges || data.edges.length === 0) {
    showTemporaryMessage(`No connecting edges found for node ${nodeId}.`);
    return;
  };

  // merge distinct nodes onto graph:
  var nodes: any = [];
  data.nodes
    .filter((n: any) => { return !graph.nodes.getIds().includes(n.id) })
    .forEach((n: any) => {
      nodes.push({
        id: n.id,
        code: n.title.code,
        rawLabels: n.labels,
        label: getNodeDisplayName(n),
        title: createNodeTooltip(n),
        shape: getNodeShape(n),
        color: getNodeColor(n),
        size: 25,
        font: { color: '#fff', size: 12 },
        borderWidth: 2,
        shadow: { enabled: true, color: 'rgba(0,0,0,0.3)', size: 5 },
        widthConstraint: { maximum: 150 },
      }
    )}
  );
  graph.nodes.add(nodes);

  // merge distinct edges:
  var edges: any = [];
  data.edges
    .filter((e: any) => { return !graph.edges.getIds().includes(e.id) })
    .forEach((e: any) => {
      const edgeStyle = getEdgeStyle(e);
      edges.push({
        id: e.id,
        from: e.from,
        to: e.to,
        label: e.label,
        title: createEdgeTooltip(e),
        color: edgeStyle.color,
        width: edgeStyle.width,
        dashes: edgeStyle.dashes,
        arrows: edgeStyle.arrows,
        font: { color: '#fff', size: 10, background: 'rgba(0,0,0,0.5)' },
        smooth: { enabled: true, type: 'continuous' as const, roundness: 0.5 },
      }
    )}
  );
  graph.edges.add(edges);
}

function focusOnNode(nodeId: string, network: Network) {
  if (network) {
    network.focus(nodeId, {
      scale: 1.5,
      animation: {
        duration: 1000,
        easingFunction: 'easeInOutQuad'
      }
    });

    // Highlight the node temporarily
    network.selectNodes([nodeId]);
    setTimeout(() => {
      network.unselectAll();
    }, 2000);
  }
  
  console.log('[DEBUG] Focused on node:', nodeId);
}

function copyToClipboard(text: string) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      console.log('[DEBUG] Copied to clipboard:', text);
      showTemporaryMessage('Node ID copied to clipboard!');
    }).catch(err => {
      console.error('[DEBUG] Failed to copy to clipboard:', err);
    });
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showTemporaryMessage('Node ID copied to clipboard!');
  }
}

export function getTrackedNodes(graph: GraphRef): any {
  return graph.nodes.get().filter((n: any) => {
    return n.rawLabels.includes("TrackedVariable");
  });
}

function highlightTrackedNodes(graph: any) {
  const trackedNodes = getTrackedNodes(graph);
  const pulseNode = (n: any) => {
    graph.nodes.update({
      id: n.id,
      borderWidth: 5,
      shape: "dot",
      size: 75,
      color: { border: '#fff', background: '#EE4B2B' },
    });
      setTimeout(() => {
        graph.nodes.update({
          id: n.id,
          shape: "circle",
          borderWidth: 3,
          color: n.color,
        })
      }, 500);
  };

  trackedNodes.forEach((n: any) => {
    pulseNode(n);
    var i = 0;
    const ival = setInterval(() => {
      pulseNode(n);
      i++;
      if (i >= 5) clearInterval(ival);
    }, 1000);

  });
}

function showTemporaryMessage(message: string) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(40, 40, 40, 0.9);
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 3000;
    animation: slideInRight 0.3s ease-out;
  `;
  
  // Add animation keyframes
  if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease-in forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}
