import { useEffect, useRef, useState } from 'react';
import { DataSet, Network } from 'vis-network/standalone';
import {
  Box,
  VStack,
  HStack,
  Input,
  Button,
  Checkbox,
  Text,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import type {
  GraphNode,
  GraphEdge,
  EnabledFilters,
} from '../utils/graphUtils';
import {
  getNodeShape,
  getNodeColor,
  getEdgeStyle,
  createNodeTooltip,
  createEdgeTooltip,
  filterGraphData,
  getNodeDisplayName,
  showContextMenu,
  hideContextMenu,
} from '../utils/graphUtils';
import type { OptionGroup } from "../utils/queryGeneration.ts"
import { highlightCorrespondingCode, removeHighlightNode } from '../utils/codeHighlight'
import { FaSearch } from 'react-icons/fa';

interface GraphVisualizationProps {
  data: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  } | null;
  project: string | undefined,
  tracked: OptionGroup[],
  height?: string;
}

export function GraphVisualization({ data, project, height = '100%' }: GraphVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodeRef = useRef<DataSet<any>>(new DataSet([]));
  const edgeRef = useRef<DataSet<any>>(new DataSet([]));
  const [searchTerm, setSearchTerm] = useState('');
  const [originalData, setOriginalData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [filteredData, setFilteredData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  
  // Hide context on outside click:
  document.addEventListener('click', hideContextMenu);

  // Filter states
  const [filters, setFilters] = useState<EnabledFilters>({
    function: true,
    variable: true,
    operator: true,
    literal: true,
    unsafe: true,
    other: true,
  });

  // Store original data when it changes
  useEffect(() => {
    if (data) {
      console.log('[GraphVisualization] Received data:', data);
      console.log('[GraphVisualization] Node count:', data.nodes?.length);
      console.log('[GraphVisualization] Edge count:', data.edges?.length);
      console.log('[GraphVisualization] Sample node:', data.nodes?.[0]);
      setOriginalData(data);
      applyFilters(data, searchTerm, filters);
    }
  }, [data]);

  // Apply filters whenever search term or filters change
  useEffect(() => {
    if (originalData) {
      applyFilters(originalData, searchTerm, filters);
    }
  }, [searchTerm, filters, originalData]);

  const applyFilters = (
    sourceData: { nodes: GraphNode[]; edges: GraphEdge[] },
    search: string,
    enabledFilters: EnabledFilters
  ) => {
    const filtered = filterGraphData(sourceData.nodes, sourceData.edges, search, enabledFilters);
    console.log('[GraphVisualization] Filtered data:', filtered);
    console.log('[GraphVisualization] Filtered node count:', filtered.nodes.length);
    console.log('[GraphVisualization] Filters:', enabledFilters);
    setFilteredData(filtered);
  };

  const handleFilterChange = (filterKey: keyof EnabledFilters) => {
    setFilters(prev => ({ ...prev, [filterKey]: !prev[filterKey] }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({
      function: true,
      variable: true,
      operator: true,
      literal: true,
      unsafe: true,
      other: true,
    });
  };

  // Zoom control functions
  const handleZoomIn = () => {
    if (networkRef.current) {
      const currentScale = networkRef.current.getScale();
      const newScale = Math.min(currentScale * 1.2, 3.0); // Max zoom 3x
      networkRef.current.moveTo({ scale: newScale });
      setZoomLevel(newScale);
    }
  };

  const handleZoomOut = () => {
    if (networkRef.current) {
      const currentScale = networkRef.current.getScale();
      const newScale = Math.max(currentScale * 0.8, 0.3); // Min zoom 0.3x
      networkRef.current.moveTo({ scale: newScale });
      setZoomLevel(newScale);
    }
  };

  const handleFitToView = () => {
    if (networkRef.current) {
      networkRef.current.fit({
        animation: {
          duration: 500,
          easingFunction: 'easeInOutQuad',
        },
      });
      // Update zoom level after fit
      setTimeout(() => {
        if (networkRef.current) {
          setZoomLevel(networkRef.current.getScale());
        }
      }, 500);
    }
  };

  // Render the graph
  useEffect(() => {
    if (!containerRef.current || !filteredData) return;

    // Clear previous network
    if (networkRef.current) {
      networkRef.current.destroy();
      networkRef.current = null;
    }

    // Enhance nodes with styling and tooltips
    var enhancedNodes = filteredData.nodes.map(node => ({
      id: node.id,
      code: node.title.code,
      rawLabels: node.labels,
      label: getNodeDisplayName(node), // Use actual node name instead of type
      title: createNodeTooltip(node),
      shape: getNodeShape(node),
      color: getNodeColor(node),
      size: 25,
      font: { color: '#fff', size: 12 },
      borderWidth: 2,
      shadow: { enabled: true, color: 'rgba(0,0,0,0.3)', size: 5 },
      widthConstraint: { maximum: 150 }, // Fixed width for consistent sizing
    }));

    console.log('[GraphVisualization] Enhanced nodes count:', enhancedNodes.length);
    console.log('[GraphVisualization] Sample enhanced node:', enhancedNodes[0]);

    // Enhance edges with styling and tooltips
    var enhancedEdges = filteredData.edges.map(edge => {
      const edgeStyle = getEdgeStyle(edge);
      return {
        id: edge.id,
        from: edge.from,
        to: edge.to,
        label: edge.label,
        title: createEdgeTooltip(edge),
        color: edgeStyle.color,
        width: edgeStyle.width,
        dashes: edgeStyle.dashes,
        arrows: edgeStyle.arrows,
        font: { color: '#fff', size: 10, background: 'rgba(0,0,0,0.5)' },
        smooth: { enabled: true, type: 'continuous' as const, roundness: 0.5 },
      };
    });

    // Create network
    console.log('[GraphVisualization] Creating Network with container:', containerRef.current);
    console.log('[GraphVisualization] Nodes for Network:', enhancedNodes.length);
    console.log('[GraphVisualization] Edges for Network:', enhancedEdges.length);

    const removeDuplicateByID = (arr: {id: string}[]) => {
      var s: any[] = [];
      return arr.filter(e => { 
        if (!s.includes(e.id)) {
          s.push(e.id)
          return true;
        }
        return false;
      });
    }

    // visjs hates disconnected graphs
    const separateComponents = (nodes: any[], edges: any[]) => {
      const adjacency = new Map<string, Set<string>>();
      nodes.forEach(node => adjacency.set(node.id, new Set()));
      edges.forEach(edge => {
        adjacency.get(edge.from)?.add(edge.to);
        adjacency.get(edge.to)?.add(edge.from);
      });
      const visited = new Set<string>();
      const components: string[][] = [];
      
      nodes.forEach(node => {
        if (visited.has(node.id)) return;
        const component: string[] = [];
        const queue = [node.id];
        while (queue.length > 0) {
          const current = queue.shift()!;
          if (visited.has(current)) continue;
          visited.add(current);
          component.push(current);
          adjacency.get(current)?.forEach(neighbor => {
            if (!visited.has(neighbor)) {
              queue.push(neighbor);
            }
          });
        }
        components.push(component);
      });
      // console.log(nodes);
      
      const s = 200;
      const cols = Math.ceil(Math.sqrt(components.length));
      const positionedNodes = nodes.map(node => ({ ...node }));
      components.forEach((component, index) => {
        const componentSize = component.length;
        const radius = Math.max(150, componentSize * 30);

        // console.log(radius);
        component.forEach((nodeId, nodeIndex) => {
          const node = positionedNodes.find(n => n.id === nodeId);
          // console.log(node);
          if (node) {
            const angle = (nodeIndex / componentSize) * 2 * Math.PI;
            // console.log(angle);
            node.x = (index % cols) * s + radius * Math.cos(angle);
            node.y = (Math.floor(index / cols)) * s + radius * Math.sin(angle);
            // console.log(node.x, node.y);
          }
        });
      });
      return positionedNodes;
    };

    const processParallelEdges = (edges: any[]) => {
      const edgeGroups = new Map<string, any[]>();
      edges.forEach(edge => {
        const key = `${edge.from}-${edge.to}`;
        if (!edgeGroups.has(key)) {
          edgeGroups.set(key, []);
        }
        edgeGroups.get(key)!.push(edge);
      });
        
      // console.log(edgeGroups);
      
      // parallel edges overlap almost 100% of the time.
      // the only workaround i can think to do for that is to modify the curve weight.
      const processedEdges: any[] = [];
        edgeGroups.forEach((group, _) => {
          if (group.length === 1) {
            processedEdges.push({...group[0], smooth: {enabled: false}});
          } else {
            group.forEach((edge, index) => {
              const totalEdges = group.length;
              const offset = index - (totalEdges - 1) / 2;
              const roundness = 0.2 + (Math.abs(offset) * 0.2);
              // console.log(roundness);
              // console.log(offset);
              processedEdges.push({
                ...edge,
                smooth: {
                  enabled: true,
                  type: offset >= 0 ? 'curvedCW' : 'curvedCCW',
                  roundness: roundness,
                }
              });
            });
          }
        });
        return processedEdges;
    };
    const processedEdges = processParallelEdges(enhancedEdges);
    const separatedNodes = separateComponents(enhancedNodes, processedEdges);

    // Kill duplicates:
    edgeRef.current = new DataSet(removeDuplicateByID(processedEdges));
    nodeRef.current = new DataSet(removeDuplicateByID(separatedNodes));

    const network = new Network(
      containerRef.current,
      {
        nodes: nodeRef.current!!,
        edges: edgeRef.current!!,
      },
      {
        nodes: {
          shape: 'dot',
          size: 25,
          font: { color: '#fff', size: 12 },
          borderWidth: 2,
          shadow: { enabled: true, color: 'rgba(0,0,0,0.3)', size: 5 },
          chosen: true,
          widthConstraint: { maximum: 150 }, // Fixed width for all nodes
        },
        edges: {
          color: { color: '#fff' },
          arrows: 'to',
          font: { color: '#fff', size: 12, strokeWidth: 0, align: 'top' },
          width: 2,
          smooth: { enabled: true, type: 'dynamic', roundness: 0.5 },
          chosen: true,
        },
        layout: { improvedLayout: true },
        physics: {
          enabled: true,
          stabilization: {
            enabled: true,
            iterations: 800,
            fit: true,
          },
          barnesHut: {
            gravitationalConstant: -5000,
            centralGravity: 0.005,
            springConstant: 0.04,
            springLength: 100,
            damping: 0.35,
            avoidOverlap: 0.8,
          },
        },
        interaction: {
          hover: true,
          tooltipDelay: 300,
          hideEdgesOnDrag: false,
          selectConnectedEdges: false,
          zoomView: true,
          dragView: true,
          zoomSpeed: 0.5, // Slower zoom for better control
        },
      }
    );

    network.once('stabilizationIterationsDone', () => {
      network.stopSimulation();
      network.fit({});
    });

    networkRef.current = network;

    // Set zoom limits
    network.on('zoom', () => {
      const scale = network.getScale();
      if (scale > 3.0) {
        network.moveTo({ scale: 3.0 });
        setZoomLevel(3.0);
      } else if (scale < 0.3) {
        network.moveTo({ scale: 0.3 });
        setZoomLevel(0.3);
      } else {
        setZoomLevel(scale);
      }
    });

    // Add event listeners
    network.on('hoverNode', (params) => {
      const node: any = (nodeRef.current!!).get(params.node);
      if (!node) return;

      console.log('[DEBUG] Hovering over node:', node);

      // Code highlighting:
      if (node.code && !node.rawLabels.includes("Literal")) {
        highlightCorrespondingCode(node.id, node.code);
      }
    });

    network.on("showPopup", (params) => {
      const tooltip = document.querySelector(".vis-tooltip");
      if (tooltip) {
        const node: any = (nodeRef.current!!).get(params);
        const edge: any = (edgeRef.current!!).get(params);
        if (node) {
          tooltip.innerHTML = node.title;
        } else {
          tooltip.innerHTML = edge.title;
        }
      }
    });

    network.on('blurNode', (params) => {
      removeHighlightNode(params.node.toString());
    })

    network.on('selectNode', (params) => {
      console.log('[DEBUG] Selected node:', params.nodes[0]);
    });

    // Context menu:
    network.on('oncontext', (params) => {
      params.event.preventDefault();
      showContextMenu(
        params, 
        {nodes: nodeRef.current!!, edges: edgeRef.current!!, projectId: project!!},
        network,
        params.nodes.length > 0 ? "node" : "canvas");
    });

    // Canvas click:
    network.on("click", function (_) {
      hideContextMenu();
    });

    // Set initial zoom level
    setZoomLevel(network.getScale());

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [filteredData]);

  const nodeCount = filteredData?.nodes.length || 0;
  const totalNodeCount = originalData?.nodes.length || 0;

  return (
    <VStack align="stretch" spacing={3} h={height}>
      {/* Graph Controls */}
      <Box bg="gray.700" p={3} borderRadius="md">
        {/* Help Text */}
        <Text fontSize="xs" color="gray.400" mb={2} borderLeft="3px solid" borderColor="gray.600" pl={2}>
          💡 <strong>Tips:</strong> Search nodes, toggle filters, or hover over nodes/edges for details
        </Text>

        {/* Search and Clear */}
        <HStack spacing={3} mb={2}>
          <InputGroup flex={1}>
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Search nodes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="sm"
              bg="gray.800"
              border="1px solid"
              borderColor="gray.600"
              color="white"
              _placeholder={{ color: 'gray.500' }}
            />
          </InputGroup>
          
          <Text fontSize="sm" color="gray.300" minW="120px" textAlign="center">
            Showing: {nodeCount}/{totalNodeCount}
          </Text>
          
          <Button size="sm" onClick={clearFilters} colorScheme="gray" variant="solid">
            Clear Filters
          </Button>
        </HStack>

        {/* Filter Toggles */}
        <HStack spacing={4} flexWrap="wrap" fontSize="sm">
          <Checkbox
            isChecked={filters.function}
            onChange={() => handleFilterChange('function')}
            colorScheme="green"
            textColor="#E2EEF0"
            size="sm"
          >
            Functions
          </Checkbox>
          <Checkbox
            isChecked={filters.variable}
            onChange={() => handleFilterChange('variable')}
            colorScheme="blue"
            textColor="#E2EEF0"
            size="sm"
          >
            Variables
          </Checkbox>
          <Checkbox
            isChecked={filters.operator}
            onChange={() => handleFilterChange('operator')}
            colorScheme="yellow"
            textColor="#E2EEF0"
            size="sm"
          >
            Operators
          </Checkbox>
          <Checkbox
            isChecked={filters.literal}
            onChange={() => handleFilterChange('literal')}
            colorScheme="purple"
            textColor="#E2EEF0"
            size="sm"
          >
            Literals
          </Checkbox>
          <Checkbox
            isChecked={filters.unsafe}
            onChange={() => handleFilterChange('unsafe')}
            colorScheme="red"
            textColor="#E2EEF0"
            size="sm"
          >
            Unsafe Operations
          </Checkbox>
          <Checkbox
            isChecked={filters.other}
            onChange={() => handleFilterChange('other')}
            colorScheme="gray"
            textColor="#E2EEF0"
            size="sm"
          >
            Other
          </Checkbox>
        </HStack>

        {/* Edge Legend */}
        <Box mt={3} pt={3} borderTop="1px solid" borderColor="gray.600">
          <Text fontSize="xs" color="gray.400" mb={2}>
            🎨 <strong>Edge Types Legend:</strong>
          </Text>
          <HStack spacing={4} flexWrap="wrap" fontSize="xs" color="gray.300">
            <HStack spacing={1}>
              <Box w="20px" h="2px" bg="#28a745" />
              <Text>DFG (Data Flow)</Text>
            </HStack>
            <HStack spacing={1}>
              <Box w="20px" h="3px" bg="#007acc" />
              <Text>EOG (Execution)</Text>
            </HStack>
            <HStack spacing={1}>
              <Box w="20px" h="1px" bg="#6f42c1" />
              <Text>AST (Syntax)</Text>
            </HStack>
            <HStack spacing={1}>
              <Box w="20px" h="2px" bg="#ffc107" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 5px, rgba(0,0,0,0.3) 5px, rgba(0,0,0,0.3) 10px)' }} />
              <Text>REFERS_TO</Text>
            </HStack>
            <HStack spacing={1}>
              <Box w="20px" h="2px" bg="#e83e8c" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(0,0,0,0.3) 8px, rgba(0,0,0,0.3) 12px)' }} />
              <Text>PDG</Text>
            </HStack>
            <HStack spacing={1}>
              <Box w="20px" h="2px" bg="#fd7e14" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.3) 3px, rgba(0,0,0,0.3) 6px)' }} />
              <Text>USAGE</Text>
            </HStack>
            <HStack spacing={1}>
              <Box w="20px" h="1px" bg="#20c997" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(0,0,0,0.3) 6px, rgba(0,0,0,0.3) 10px)' }} />
              <Text>SCOPE</Text>
            </HStack>
          </HStack>
        </Box>
      </Box>

      {/* Graph Container with Zoom Controls */}
      <Box position="relative" h={height} w="100%">
        <Box
          ref={containerRef}
          bg="gray.900"
          borderRadius="md"
          border="1px solid"
          borderColor="gray.700"
          h="100%"
          w="100%"
        />
        
        {/* Floating Zoom Controls - Bottom Right */}
        <VStack
          position="absolute"
          bottom="16px"
          right="16px"
          spacing={1}
          bg="rgba(0, 0, 0, 0.8)"
          p={2}
          borderRadius="md"
          border="1px solid"
          borderColor="gray.600"
          boxShadow="lg"
          zIndex={10}
        >
          <Text fontSize="xs" color="gray.300" fontWeight="bold">
            {(zoomLevel * 100).toFixed(0)}%
          </Text>
          <Button
            size="xs"
            onClick={handleZoomIn}
            colorScheme="blue"
            variant="solid"
            width="40px"
            height="30px"
            fontSize="16px"
          >
            +
          </Button>
          <Button
            size="xs"
            onClick={handleZoomOut}
            colorScheme="blue"
            variant="solid"
            width="40px"
            height="30px"
            fontSize="16px"
          >
            −
          </Button>
          <Button
            size="xs"
            onClick={handleFitToView}
            colorScheme="green"
            variant="solid"
            width="40px"
            height="30px"
            fontSize="12px"
            p={1}
          >
            <FaSearch />
          </Button>
        </VStack>
      </Box>
    </VStack>
  );
}
