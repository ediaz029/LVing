import { Box, Flex, HStack, Heading, Link as ChakraLink, Icon, Text } from "@chakra-ui/react";
import { Link as ReactRouterLink, Outlet, useLocation } from "react-router-dom";
import { FaCode, FaProjectDiagram } from "react-icons/fa";

export function Layout() {
  const location = useLocation();
  
  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <Flex direction="column" minH="100vh" bg="gray.50">
      {/* Professional Navbar */}
      <Box
        as="header"
        w="100%"
        bg="gray.800"
        color="white"
        position="sticky"
        top="0"
        zIndex="1000"
        boxShadow="md"
      >
        <Flex
          maxW="1400px"
          mx="auto"
          px={8}
          py={4}
          alignItems="center"
          justifyContent="space-between"
        >
          {/* Logo/Brand */}
          <HStack spacing={3} as={ReactRouterLink} to="/" _hover={{ opacity: 0.8 }}>
            <Icon as={FaCode} boxSize={6} color="blue.400" />
            <Heading size="md" fontWeight="bold" letterSpacing="tight">
              LVing Code Analyzer
            </Heading>
          </HStack>

          {/* Navigation Links */}
          <HStack spacing={1}>
            <ChakraLink
              as={ReactRouterLink}
              to="/"
              px={4}
              py={2}
              borderRadius="md"
              bg={isActive("/") && location.pathname === "/" ? "gray.700" : "transparent"}
              _hover={{ bg: "gray.700" }}
              fontWeight="medium"
              transition="background 0.2s"
            >
              <HStack spacing={2}>
                <Icon as={FaProjectDiagram} />
                <Text>Projects</Text>
              </HStack>
            </ChakraLink>
            {/*<ChakraLink
              as={ReactRouterLink}
              to="/new-project"
              px={4}
              py={2}
              borderRadius="md"
              bg={isActive("/new-project") ? "blue.600" : "blue.500"}
              _hover={{ bg: "blue.600" }}
              fontWeight="medium"
              transition="background 0.2s"
              ml={2}
            >
              + New Project
            </ChakraLink>
            */}
          </HStack>
        </Flex>
      </Box>

      {/* Main Content */}
      <Box as="main" flex="1" w="100%">
        <Outlet />
      </Box>
    </Flex>
  );
}
