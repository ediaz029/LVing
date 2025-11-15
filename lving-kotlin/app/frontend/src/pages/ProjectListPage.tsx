import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Button,
  Input,
  InputGroup,
  InputLeftElement,
  HStack,
  VStack,
  Text,
  Flex,
  IconButton,
  Tooltip,
  Container,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import { SearchIcon, ViewIcon, RepeatIcon } from "@chakra-ui/icons";

interface Project {
  id: string;
  name: string;
  status: string;
  createdAt: number;
}

const fetchProjects = async (): Promise<Project[]> => {
  const response = await axios.get("/projects");
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

export function ProjectListPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: projects, isLoading, error, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  projects?.sort((a, b) => b.createdAt - a.createdAt);

  const filteredProjects = projects?.filter((project) =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <Box bg="gray.50" minH="calc(100vh - 72px)">
        <Flex justify="center" align="center" h="400px">
          <VStack spacing={4}>
            <Spinner size="xl" thickness="4px" color="blue.500" />
            <Text color="gray.600">Loading projects...</Text>
          </VStack>
        </Flex>
      </Box>
    );
  }

  if (error) {
    return (
      <Box bg="gray.50" minH="calc(100vh - 72px)">
        <Container maxW="1400px" py={8} px={8}>
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <AlertTitle>Error loading projects</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "Unknown error occurred"}
            </AlertDescription>
          </Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box bg="gray.50" minH="calc(100vh - 72px)">
      <Container maxW="1400px" py={8} px={8}>
        <VStack spacing={6} align="stretch">
          {/* Header Section */}
          <Flex justify="space-between" align="center">
            <Box>
              <Heading size="xl" mb={2} color="gray.800">
                Projects
              </Heading>
              <Text color="gray.600" fontSize="md">
                Manage and analyze your Rust code projects
              </Text>
            </Box>
            {/*<Button
              colorScheme="blue"
              size="lg"
              onClick={() => navigate("/new-project")}
              px={8}
            >
              + New Project
            </Button>*/}
          </Flex>

          {/* Search and Filter Bar */}
          <HStack spacing={4} bg="white" p={4} borderRadius="lg" boxShadow="sm">
            <InputGroup flex={1}>
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search projects by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                bg="white"
                border="1px solid"
                borderColor="gray.300"
                _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px blue.500" }}
              />
            </InputGroup>
            <Tooltip label="Refresh projects">
              <IconButton
                aria-label="Refresh projects"
                icon={<RepeatIcon />}
                onClick={() => refetch()}
                variant="outline"
              />
            </Tooltip>
          </HStack>

          {/* Projects Table */}
          {!filteredProjects || filteredProjects.length === 0 ? (
            <Box
              bg="white"
              p={16}
              borderRadius="lg"
              textAlign="center"
              boxShadow="sm"
            >
              <VStack spacing={4}>
                <Box fontSize="4xl">📦</Box>
                <Heading size="md" color="gray.600">
                  {searchTerm ? "No projects found" : "No projects yet"}
                </Heading>
                <Text color="gray.500" maxW="md">
                  {searchTerm
                    ? "Try adjusting your search term"
                    : "Create your first project to start analyzing Rust code"}
                </Text>
                {!searchTerm && (
                  <Button
                    colorScheme="blue"
                    size="lg"
                    mt={4}
                    onClick={() => navigate("/new-project")}
                  >
                    Create First Project
                  </Button>
                )}
              </VStack>
            </Box>
          ) : (
            <Box bg="white" borderRadius="lg" overflow="hidden" boxShadow="sm">
              <Table variant="simple">
                <Thead bg="gray.50">
                  <Tr>
                    <Th fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="gray.600">
                      Project Name
                    </Th>
                    <Th fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="gray.600">
                      Status
                    </Th>
                    <Th fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="gray.600">
                      Created
                    </Th>
                    <Th fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="gray.600">
                      Actions
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredProjects.map((project) => (
                    <Tr
                      key={project.id}
                      _hover={{ bg: "gray.50" }}
                      transition="background 0.2s"
                    >
                      <Td>
                        <Text fontWeight="semibold" color="gray.800">
                          {project.name}
                        </Text>
                      </Td>
                      <Td>
                        <Badge
                          colorScheme={getStatusColor(project.status)}
                          px={3}
                          py={1}
                          borderRadius="full"
                          fontSize="xs"
                          fontWeight="medium"
                        >
                          {project.status}
                        </Badge>
                      </Td>
                      <Td>
                        <Text fontSize="sm" color="gray.600">
                          {new Date(project.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </Td>
                      <Td>
                        <Tooltip label="View project details">
                          <IconButton
                            aria-label="View project"
                            icon={<ViewIcon />}
                            size="sm"
                            colorScheme="blue"
                            variant="ghost"
                            onClick={() => navigate(`/projects/${project.id}`)}
                          />
                        </Tooltip>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}

          {/* Stats Footer */}
          {filteredProjects && filteredProjects.length > 0 && (
            <Text fontSize="sm" color="gray.600" textAlign="center">
              Showing {filteredProjects.length} of {projects?.length || 0} project
              {(projects?.length || 0) !== 1 ? "s" : ""}
            </Text>
          )}
        </VStack>
      </Container>
    </Box>
  );
}
