// Graph visualization utility functions

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
  
  // Priority order: name > fullName > code (truncated) > label (type)
  if (node.title.name) {
    displayName = node.title.name;
  } else if (node.title.fullName) {
    displayName = node.title.fullName;
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

// Node shape based on type
export function getNodeShape(node: GraphNode): string {
  const label = node.label?.toLowerCase() || '';
  if (label.includes('function') || label.includes('method')) return 'box';
  if (label.includes('variable') || label.includes('declaration')) return 'circle';
  if (label.includes('operator')) return 'diamond';
  if (label.includes('literal')) return 'triangle';
  return 'dot'; // default
}

// Node color based on type and properties
export function getNodeColor(node: GraphNode): { background: string; border: string } {
  const label = node.label?.toLowerCase() || '';
  
  // Color by node type
  if (label.includes('function')) return { background: '#28a745', border: '#fff' };
  if (label.includes('variable')) return { background: '#007acc', border: '#fff' };
  if (label.includes('operator')) return { background: '#ffc107', border: '#fff' };
  if (label.includes('literal')) return { background: '#6f42c1', border: '#fff' };
  
  // Check for unsafe or risky properties
  const titleString = JSON.stringify(node.title || {}).toLowerCase();
  if (titleString.includes('unsafe') || titleString.includes('*mut') || titleString.includes('raw')) {
    return { background: '#dc3545', border: '#fff' }; // Red for unsafe
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
  let tooltipText = `Node: ${node.label}\nID: ${node.id}`;
  
  if (node.title && typeof node.title === 'object') {
    Object.entries(node.title).forEach(([key, value]) => {
      if (key !== 'id' && value !== null && value !== undefined) {
        // Truncate long values
        const valueStr = String(value);
        const displayValue = valueStr.length > 100 ? valueStr.substring(0, 100) + '...' : valueStr;
        tooltipText += `\n${key}: ${displayValue}`;
      }
    });
  }
  
  return tooltipText;
}

// Create rich tooltip for edges
export function createEdgeTooltip(edge: GraphEdge): string {
  let tooltipText = `Relationship: ${edge.label}\nFrom: ${edge.from} → To: ${edge.to}`;
  
  if (edge.title && typeof edge.title === 'object') {
    Object.entries(edge.title).forEach(([key, value]) => {
      if (key !== 'id' && value !== null && value !== undefined) {
        tooltipText += `\n${key}: ${value}`;
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

function moveTooltip(tooltip: HTMLElement, event: any) {
  // Get mouse position from different possible event properties
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
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}

export function showCustomTooltip(event: any, text: string) {
  hideCustomTooltip(); // Remove any existing tooltip
  
  const tooltip = document.createElement('div');
  tooltip.id = 'custom-tooltip';
  tooltip.style.cssText = `
    position: absolute;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-family: monospace;
    white-space: pre-line;
    z-index: 1000;
    pointer-events: none;
    max-width: 300px;
    border: 1px solid #444;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `;
  
  tooltip.textContent = text;
  document.body.appendChild(tooltip);
  moveTooltip(tooltip, event);
}

export function hideCustomTooltip() {
  const existing = document.getElementById('custom-tooltip');
  if (existing) {
    existing.remove();
    console.log('[DEBUG] Custom tooltip removed');
  }
}

export function dragCustomTooltip(event : any) {
  const existing = document.getElementById('custom-tooltip');
  if (!existing) return;
  moveTooltip(existing, event);
}
