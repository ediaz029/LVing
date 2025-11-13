import {
  Box,
  Heading,
  FormControl,
  FormLabel,
  Input,
  Button,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  VStack,
  Text,
  Container,
  Card,
  CardBody,
  Divider,
  Select,
  Spinner,
} from "@chakra-ui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import { CodeMirrorEditor } from "../components/CodeMirrorEditor";
import { ArrowBackIcon } from "@chakra-ui/icons";

interface NewProjectData {
  name: string;
  sourceCode: string;
}

interface CreatedProject {
  id: string;
  name: string;
  status: string;
  sourceCodePath: string;
  llvmIrPath: string | null;
  createdAt: number;
  analysisResult: string | null;
}

interface CodeExample {
  id: string;
  name: string;
  filename: string;
}

const createProject = async (data: NewProjectData): Promise<CreatedProject> => {
  const response = await axios.post("/projects", data);
  return response.data;
};

const fetchExamples = async (): Promise<CodeExample[]> => {
  const response = await axios.get("/examples");
  return response.data;
};

const fetchExampleCode = async (id: string): Promise<string> => {
  const response = await axios.get(`/examples/${id}`);
  return response.data;
};

export function NewProjectPage() {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("");
  const [sourceCode, setSourceCode] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [loadingCode, setLoadingCode] = useState(false);

  // Fetch available code examples
  const { data: examples, isLoading: examplesLoading } = useQuery({
    queryKey: ["codeExamples"],
    queryFn: fetchExamples,
  });

  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: (data) => {
      navigate(`/projects/${data.id}`);
    },
  });

  const handleTemplateChange = async (exampleId: string) => {
    setSelectedTemplate(exampleId);
    
    if (!exampleId) {
      setSourceCode("");
      return;
    }
    
    // Fetch the code for the selected example
    setLoadingCode(true);
    try {
      const code = await fetchExampleCode(exampleId);
      setSourceCode(code);
    } catch (error) {
      console.error("Error loading example code:", error);
      alert("Failed to load example code. Please try again.");
    } finally {
      setLoadingCode(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !sourceCode.trim()) {
      return;
    }
    mutation.mutate({ name: projectName, sourceCode });
  };

  return (
    <Box bg="gray.50" minH="calc(100vh - 72px)" py={8}>
      <Container maxW="1000px" px={8}>
        <VStack spacing={6} align="stretch">
          {/* Header with Back Button */}
          <Box>
            <Button
              leftIcon={<ArrowBackIcon />}
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              mb={4}
            >
              Back to Projects
            </Button>
            <Heading size="xl" mb={2} color="gray.800">
              Create New Project
            </Heading>
            <Text color="gray.600" fontSize="md">
              Set up a new Rust project for code analysis
            </Text>
          </Box>

          {/* Form Card */}
          <Card boxShadow="lg" bg="white">
            <CardBody>
              <form onSubmit={handleSubmit}>
                <VStack spacing={6} align="stretch">
                  {/* Project Details Section */}
                  <Box>
                    <Heading size="md" mb={4} color="gray.700">
                      Project Details
                    </Heading>
                    <FormControl isRequired>
                      <FormLabel fontWeight="semibold">Project Name</FormLabel>
                      <Input
                        placeholder="e.g., My Rust Analysis Project"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        size="lg"
                        bg="white"
                        border="1px solid"
                        borderColor="gray.300"
                        _focus={{
                          borderColor: "blue.500",
                          boxShadow: "0 0 0 1px blue.500",
                        }}
                      />
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        Choose a descriptive name for your project
                      </Text>
                    </FormControl>
                  </Box>

                  <Divider />

                  {/* Source Code Section */}
                  <Box>
                    <Heading size="md" mb={4} color="gray.700">
                      Source Code
                    </Heading>
                    
                    {/* Template Selector */}
                    <FormControl mb={4}>
                      <FormLabel fontWeight="semibold">Code Template</FormLabel>
                      <Select
                        value={selectedTemplate}
                        onChange={(e) => handleTemplateChange(e.target.value)}
                        size="lg"
                        bg="white"
                        border="1px solid"
                        borderColor="gray.300"
                        isDisabled={examplesLoading || loadingCode}
                      >
                        <option value="">
                          {examplesLoading ? "Loading examples..." : "Select an example..."}
                        </option>
                        {examples?.map((example) => (
                          <option key={example.id} value={example.id}>
                            {example.name}
                          </option>
                        ))}
                      </Select>
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        {loadingCode ? (
                          <>
                            <Spinner size="xs" mr={2} />
                            Loading code example...
                          </>
                        ) : (
                          "Select a template to get started quickly"
                        )}
                      </Text>
                    </FormControl>

                    {/* Code Editor */}
                    <FormControl isRequired>
                      <FormLabel fontWeight="semibold">Rust Code</FormLabel>
                      <Text fontSize="sm" color="gray.600" mb={3}>
                        Write or paste your Rust code below. The editor supports syntax highlighting and line numbers.
                      </Text>
                      <Box
                        border="2px solid"
                        borderColor="gray.200"
                        borderRadius="md"
                        overflow="hidden"
                      >
                        <CodeMirrorEditor
                          name=""
                          value={sourceCode}
                          onChange={setSourceCode}
                          readOnly={false}
                          language="rust"
                          height="500px"
                        />
                      </Box>
                    </FormControl>
                  </Box>

                  {/* Error Alert */}
                  {mutation.isError && (
                    <Alert status="error" borderRadius="md">
                      <AlertIcon />
                      <Box>
                        <AlertTitle>Error creating project</AlertTitle>
                        <AlertDescription>
                          {mutation.error instanceof Error
                            ? mutation.error.message
                            : "Unknown error occurred. Please try again."}
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}

                  {/* Action Buttons */}
                  <Box pt={4}>
                    <VStack spacing={3}>
                      <Button
                        type="submit"
                        colorScheme="blue"
                        size="lg"
                        width="full"
                        isLoading={mutation.isPending}
                        loadingText="Creating project..."
                        isDisabled={!projectName.trim() || !sourceCode.trim()}
                      >
                        Create Project & Start Analysis
                      </Button>
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={() => navigate("/")}
                        width="full"
                      >
                        Cancel
                      </Button>
                    </VStack>
                  </Box>
                </VStack>
              </form>
            </CardBody>
          </Card>

          {/* Help Text */}
          <Text fontSize="sm" color="gray.500" textAlign="center">
            💡 Tip: After creating the project, you'll be able to view the LLVM-IR and query the code graph
          </Text>
        </VStack>
      </Container>
    </Box>
  );
}
