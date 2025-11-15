import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  VStack,
  HStack,
  Button,
  Text,
  Textarea,
  IconButton,
} from "@chakra-ui/react";
import { Select, components } from "chakra-react-select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import axios from "axios";
import { CodeMirrorEditor } from "../components/CodeMirrorEditor";
import { GraphVisualization } from "../components/GraphVisualization";
import { CodeStrings } from "../utils/codeHighlight"
import { parseMetadata } from "../utils/metadata.ts"
import { getCypherOptions, buildCypherQuery, type OptionGroup } from "../utils/queryGeneration.ts"
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';

interface Project {
  id: string;
  name: string;
  status: string;
  sourceCodePath: string;
  llvmIrPath: string | null;
  createdAt: number;
  analysisResult: string | null;
  trackedNodes: string | null;
}

interface GraphData {
  nodes: Array<{
    id: string;
    label: string;
    labels: string[];
    title: Record<string, string>;
  }>;
  edges: Array<{
    id: string;
    from: string;
    to: string;
    label: string;
    title: Record<string, string>;
  }>;
}

const MVSOpt = (props: any) => {
  const { data } = props;

  return (
    <components.Option {...props}>
        <Box fontSize="0.8rem" lineHeight="0.6">{ data.label } </Box>
    </components.Option>
  )

}

type Direction = "<" | ">" | "<>";
const directionIcons = {
  "<": <ChevronLeftIcon />,
  ">": <ChevronRightIcon />,
  "<>": <Text fontWeight="bold">⇄</Text>,
}

const MVLabel = (props: any) => {
  const { data, selectProps } = props;
  const setDirection = selectProps.setDirection;
  if (data.allow === "single") return <components.MultiValueLabel {...props } />;

  const handleClick = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    const next: Direction = data.direction === "<" ? ">" : data.direction === ">" ? "<>" : "<";
    setDirection(data.value, next);
  };

  const handleMouseDown = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <HStack spacing={1} align="center">
      <IconButton
        h="18px"
        w="18px"
        minW="18px"
        p="0"
        fontSize="12px"
        tabIndex={-1}
        colorScheme="blue"
        icon={directionIcons[data.direction as Direction]}
        aria-label="Direction"
        onClick={handleClick}
        onMouseDown={handleMouseDown}
      />
      <Text>{data.label}</Text>
    </HStack>
  );
};

const fetchProject = async (id: string): Promise<Project> => {
  const response = await axios.get(`/projects/${id}`);
  return response.data;
};

const triggerAnalysis = async (id: string): Promise<void> => {
  await axios.post(`/projects/${id}/analyze`);
};

const executeQuery = async (id: string, query: string): Promise<GraphData> => {
  const response = await axios.post(`/projects/${id}/query`, { query });
  return response.data;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "COMPLETED":
      return "green";
    case "ERROR_RUSTC":
    case "ERROR_CPG":
    case "ERROR_NOT_FOUND":
      return "red";
    case "ANALYZING_RUSTC":
    case "ANALYZING_CPG":
      return "blue";
    default:
      return "gray";
  }
};

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [cypherQuery, setCypherQuery] = useState('');
  const [selectedExample, setSelectedExample] = useState<OptionGroup[]>([]);
  const [selectedNode, setSelectedNode] = useState([]);
  const [graphData, setGraphData] = useState<GraphData | null>(null);

  const { data: project, isLoading, error, refetch } = useQuery<Project>({
    queryKey: ["project", id],
    queryFn: () => fetchProject(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      // Auto-refresh if analysis is in progress
      const data = query.state.data;
      if (!data) return false;
      
      // Poll every 5sec during active analysis
      if (data.status === "ANALYZING_RUSTC" || data.status === "ANALYZING_CPG") {
        return 5000;
      }

      return false; // Don't poll when CREATED, COMPLETED or in error states
    },
  });

  const { data: sourceCode, isLoading: sourceLoading } = useQuery({
    queryKey: ["sourceCode", id],
    queryFn: async () => {
      const response = await axios.get(`/projects/${id}/source`);
      return response.data;
    },
    enabled: !!id,
  });

  const { data: llvmIr, isLoading: llvmLoading } = useQuery({
    queryKey: ["llvmIr", id],
    queryFn: async () => {
      const response = await axios.get(`/projects/${id}/llvm-ir`);
      return response.data;
    },
    enabled: !!id && !!project?.llvmIrPath,
  });

  const analyzeMutation = useMutation({
    mutationFn: () => triggerAnalysis(id!),
    onSuccess: async () => {
      // Wait for server response, then refetch to get updated status
      // This will trigger polling if status changed to ANALYZING_RUSTC/ANALYZING_CPG
      await refetch();
    },
  });

  const queryMutation = useMutation({
    mutationFn: (query: string) => executeQuery(id!, query),
    onSuccess: (data) => {
      setGraphData(data);
    },
  });

  const handleNodeChange = (value: any) => {
    setSelectedNode(value);
  };

  const handleExampleChange = (value: any) => {
    setSelectedExample(value);
  };

  const handleDirectionChange = (value: string, direction: Direction) => {
    setSelectedExample((e) =>
      e.map((p): OptionGroup => (p.value === value ? { ...p, direction } : p)));
  };

  useEffect(() => {
    if (selectedExample.length == 0) {
      setCypherQuery("");
      return;
    }

    if (selectedExample[0].allow === "single") {
      setCypherQuery(selectedExample[0].value);
      return;
    }

    if (selectedNode.length == 0) {
      setCypherQuery("");
      return;
    }

    const query = buildCypherQuery(selectedNode, selectedExample);
    if (query) setCypherQuery(query);
  }, [selectedExample, selectedNode]);

  const isSingleSelected = selectedExample.some(e => e.allow === "single");

  const handleRunQuery = () => {
    if (cypherQuery.trim()) {
      queryMutation.mutate(cypherQuery);
    }
  };

  if (isLoading) {
    return (
      <Box bg="gray.50" minH="calc(100vh - 72px)">
        <Box py={20} textAlign="center">
          <VStack spacing={4}>
            <Spinner size="xl" thickness="4px" color="blue.500" />
            <Text color="gray.600">Loading project details...</Text>
          </VStack>
        </Box>
      </Box>
    );
  }

  if (error || !project) {
    return (
      <Box bg="gray.50" minH="calc(100vh - 72px)">
        <Box py={8} px={8} maxW="1200px" mx="auto">
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <AlertTitle>Error loading project</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "Project not found"}
            </AlertDescription>
          </Alert>
        </Box>
      </Box>
    );
  }

  if (project.trackedNodes == null) { project.trackedNodes = ""; }
  var trackedNodes = project.trackedNodes.split(',');
  trackedNodes = trackedNodes.map( n => { return n.trim(); });
  var cypherOptions = getCypherOptions(project.name);

  const filteredCypherOptions = cypherOptions.map(group => {
    const hasSingleSelected = selectedExample.some(e => e.allow === "single");
    const hasMultiSelected = selectedExample.some(e => e.allow === "multi");
    return {
      ...group,
      options: group.options.map(opt => ({
        ...opt,
        isDisabled:
          (hasSingleSelected && opt.allow === "multi") ||
          (hasMultiSelected && opt.allow === "single"),
      })),
    };
  });

  var nodeOptions: { value: string, label: string}[] = [];
  const set = new Set<string>();
  trackedNodes.forEach( n => {
    if (set.has(n)) return;
    // At least for now, don't really care about argc or argv.
    if (!n.startsWith("arg")) {
      nodeOptions.push({ value: n, label: n});
      set.add(n);
    }
  });

  // Set IR and Rust code values for CodeStrings
  CodeStrings.RUST_CODE = sourceCode;
  CodeStrings.IR_CODE = llvmIr;
  parseMetadata(llvmIr);

  return (
    <Box bg="gray.50" minH="calc(100vh - 72px)">
      <VStack align="stretch" spacing={0}>
        {/* Header - Centered with Action Button */}
        <Box py={6}>
          <VStack spacing={2}>
            <HStack spacing={4} justify="center" align="center" w="100%">
              <HStack spacing={3}>
                <Heading size="lg" color="gray.800">{project.name}</Heading>
                <Badge colorScheme={getStatusColor(project.status)} fontSize="md" px={3} py={1}>
                  {project.status}
                </Badge>
              </HStack>
              {project.status === "CREATED" && (
                <Button
                  colorScheme="blue"
                  size="md"
                  onClick={() => analyzeMutation.mutate()}
                  isLoading={analyzeMutation.isPending}
                  isDisabled={analyzeMutation.isPending}
                  loadingText="Starting..."
                >
                  Start Analysis
                </Button>
              )}
            </HStack>
            <Text color="gray.600" fontSize="sm">
              Created: {new Date(project.createdAt).toLocaleString()}
            </Text>
          </VStack>
        </Box>

        {(project.status === "ANALYZING_RUSTC" || project.status === "ANALYZING_CPG") && (
          <Box px={8}>
            <Alert status="info">
              <AlertIcon />
              <Spinner size="sm" mr={2} />
              Analysis in progress... This page will update automatically.
            </Alert>
          </Box>
        )}

        {project.status.startsWith("ERROR_") && (
          <Box px={8}>
            <Alert status="error">
              <AlertIcon />
              <AlertTitle>Analysis failed</AlertTitle>
              <AlertDescription>
                The analysis encountered an error. Please check your Rust code and try again.
              </AlertDescription>
            </Alert>
          </Box>
        )}

        {/* 3-Panel Layout - Full Width */}
        <HStack align="stretch" spacing={0} w="100%" alignItems="flex-start">
          {/* Left Panel: Source Code */}
          <Box flex="1.6" bg="white" borderRight="1px solid" borderColor="gray.200" p={4} position="sticky" top="72px" alignSelf="flex-start">
            <VStack align="stretch" spacing={4}>
              {/* Top: Rust */}
              <Heading size="md" mb={2}>Source Code</Heading>
              {sourceLoading ? (
                <Box textAlign="center" py={10}>
                  <Spinner />
                  <Text mt={2} fontSize="sm">Loading source code...</Text>
                </Box>
              ) : (
                <CodeMirrorEditor
                  value={sourceCode || "// No source code available"}
                  name="RUST_EDITOR"
                  readOnly={true}
                  language="rust"
                  height="300px"
                />
              )}

              {/* Bottom: IR */}
              <Heading size="md" mb={2}>LLVM-IR</Heading>
              {!project.llvmIrPath ? (
                <Alert status="info">
                  <AlertIcon />
                  <Box fontSize="sm">
                    LLVM-IR will be available after the rustc compilation phase completes.
                  </Box>
                </Alert>
              ) : llvmLoading ? (
                <Box textAlign="center" py={10}>
                  <Spinner />
                  <Text mt={2} fontSize="sm">Loading LLVM-IR...</Text>
                </Box>
              ) : (
                <CodeMirrorEditor
                  value={llvmIr || "// No LLVM-IR available"}
                  name="IR_EDITOR"
                  readOnly={true}
                  language="llvm"
                  height="300px"
                />
              )}
            </VStack>
          </Box>

          {/* Right Panel: Query Graph - Wider for better visualization */}
          <VStack flex={2.4} align="stretch" minW="0" bg="white" p={4} spacing={3}>
            <Heading size="md">Query Graph</Heading>
            
            {(project.status === "CREATED" || project.status === "ANALYZING_RUSTC" || project.status === "ANALYZING_CPG") ? (
              <Alert status="info">
                <AlertIcon />
                <Box fontSize="sm">
                  Query graph will be available after analysis is complete.
                </Box>
              </Alert>
            ) : (
              <>
                {project.status.startsWith("ERROR_") && (
                  <Alert status="warning" size="sm">
                    <AlertIcon />
                    <Box fontSize="xs">
                      Analysis failed, but you can still query any data that was generated.
                    </Box>
                  </Alert>
                )}
                
                {/* Query Examples Dropdown */}
                <HStack w="100%">
                  <Box flex="0 0 25%">
                      <Text fontSize="sm" mb={1} fontWeight="medium">
                        📝 Tracking Nodes:
                      </Text>
                      <Select
                        isMulti
                        closeMenuOnSelect={false}
                        value={selectedNode}
                        onChange={(e: any) => handleNodeChange(e)}
                        size="sm"
                        placeholder="Select a node..."
                        options={nodeOptions}
                        isDisabled={isSingleSelected}
                      ></Select>
                  </Box>

                  <Box flex="0 0 74%">
                      <Text fontSize="sm" mb={1} fontWeight="medium">
                        📝 Queries and Relationships:
                      </Text>
                      <Select
                        isMulti
                        closeMenuOnSelect={false}
                        value={selectedExample}
                        {...({ setDirection: handleDirectionChange } as any)}
                        onChange={(e: any) => handleExampleChange(e)}
                        size="sm"
                        options={filteredCypherOptions}
                        placeholder="Select a query example..."
                        components= {{ MultiValueLabel: MVLabel, Option: MVSOpt }}
                      ></Select>
                  </Box>
                </HStack>

                {/* Cypher Query Editor */}
                <Box>
                  <Text fontSize="sm" mb={1} fontWeight="medium">
                    Cypher Query:
                  </Text>
                  <Textarea
                    value={cypherQuery}
                    onChange={(e) => setCypherQuery(e.target.value)}
                    placeholder="Select a query example above or write your own Cypher query here..."
                    size="sm"
                    fontFamily="monospace"
                    fontSize="12px"
                    height="120px"
                    bg="gray.50"
                    resize="vertical"
                    spellCheck="false"
                  />
                  <Button
                    mt={2}
                    size="sm"
                    colorScheme="blue"
                    onClick={handleRunQuery}
                    isLoading={queryMutation.isPending}
                    loadingText="Running..."
                    width="full"
                  >
                    Run Query
                  </Button>
                </Box>

                {/* Graph Visualization */}
                <Box>
                  {queryMutation.isPending ? (
                    <Box textAlign="center" py={10}>
                      <Spinner />
                      <Text mt={2} fontSize="sm">Executing query...</Text>
                    </Box>
                  ) : queryMutation.isError ? (
                    <Alert status="error">
                      <AlertIcon />
                      <Box fontSize="sm">
                        Error executing query: {(queryMutation.error as Error)?.message}
                      </Box>
                    </Alert>
                  ) : graphData && (graphData.nodes.length > 0 || graphData.edges.length > 0) ? (
                    <GraphVisualization data={graphData} project={id} tracked={selectedNode} height="650px" />
                  ) : (
                    <Box textAlign="center" py={10} color="gray.500" bg="gray.50" borderRadius="md">
                      <Text fontSize="md" fontWeight="medium" mb={2}>📊 Graph Visualization</Text>
                      <Text fontSize="sm">Select a query example above or write your own Cypher query</Text>
                      <Text fontSize="xs" mt={1} color="gray.400">Results will appear here</Text>
                    </Box>
                  )}
                </Box>
              </>
            )}
          </VStack>
        </HStack>
      </VStack>
    </Box>
  );
}
