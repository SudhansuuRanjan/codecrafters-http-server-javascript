const net = require("net");
const fs = require("fs");
const zlib = require("zlib");

// TCP server that listens on port 4221 and handles HTTP requests
const server = net.createServer((socket) => {
    let buffer = "";

    socket.on("data", (chunk) => {
        buffer += chunk.toString("utf8");

        // Check if the request is complete (headers and body are separated by \r\n\r\n)
        if (buffer.includes("\r\n\r\n")) {
            const request = buffer.trim();
            buffer = ""; // Reset the buffer for the next request

            const [response, shouldCloseConnection] = handleRequest(request);

            socket.write(response);

            // Close the connection only if the client requests it
            if (shouldCloseConnection) {
                socket.end();
            }
        }
    });

    socket.on("close", () => {
        console.log("Connection closed");
    });

    socket.on("error", (err) => {
        console.error("Socket error:", err);
        socket.end("HTTP/1.1 500 Internal Server Error\r\n\r\n");
    });
});

// Function to handle HTTP requests
function handleRequest(request) {
    const requestLines = request.split("\r\n");
    const [method, path] = requestLines[0].split(" ");
    const headers = parseHeaders(requestLines.slice(1));
    const body = requestLines.slice(requestLines.indexOf("") + 1).join("\r\n");

    const acceptEncoding = headers["Accept-Encoding"];
    const connectionHeader = headers["Connection"];
    const shouldClose = connectionHeader && connectionHeader.toLowerCase() === "close";

    // Handle file retrieval
    if (path.startsWith("/files/") && method === "GET") {
        const directory = process.argv[3];
        const filename = path.split("/files/")[1];
        const filePath = `${directory}${filename}`;

        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, "utf8");
            const [compressedData, contentEncodingHeader] = compressData(data, acceptEncoding);
            const response = buildResponse(200, "application/octet-stream", compressedData, contentEncodingHeader);
            return [response, shouldClose];
        } else {
            return ["HTTP/1.1 404 Not Found\r\n\r\n", shouldClose];
        }
    }

    // Handle file upload
    if (path.startsWith("/files/") && method === "POST") {
        const directory = process.argv[3];
        const filename = path.split("/files/")[1];
        const filePath = `${directory}${filename}`;

        try {
            fs.writeFileSync(filePath, body);
            return ["HTTP/1.1 201 Created\r\n\r\n", shouldClose];
        } catch (err) {
            return ["HTTP/1.1 500 Internal Server Error\r\n\r\n", shouldClose];
        }
    }

    // Handle User-Agent retrieval
    if (path === "/user-agent") {
        const userAgent = headers["User-Agent"] || "Unknown";
        const [compressedData, contentEncodingHeader] = compressData(userAgent, acceptEncoding);
        const response = buildResponse(200, "text/plain", compressedData, contentEncodingHeader);
        return [response, shouldClose];
    }

    // Handle echo endpoint
    if (path.startsWith("/echo/")) {
        const text = path.split("/echo/")[1] || "";
        const [compressedData, contentEncodingHeader] = compressData(text, acceptEncoding);
        const response = buildResponse(200, "text/plain", compressedData, contentEncodingHeader);
        return [response, shouldClose];
    }

    // Default response for invalid paths
    return ["HTTP/1.1 404 Not Found\r\n\r\n", shouldClose];
}

// Helper function to parse headers
function parseHeaders(headerLines) {
    return headerLines.reduce((headers, line) => {
        const [key, value] = line.split(": ");
        if (key && value) {
            headers[key] = value;
        }
        return headers;
    }, {});
}

// Helper function to build an HTTP response
function buildResponse(statusCode, contentType, body, contentEncoding) {
    const statusMessage = statusCode === 200 ? "OK" : "Error";
    const headers = [
        `HTTP/1.1 ${statusCode} ${statusMessage}`,
        `Content-Type: ${contentType}`,
        `Content-Length: ${body.length}`,
        contentEncoding ? `Content-Encoding: ${contentEncoding}` : "",
        "\r\n"
    ].filter(Boolean).join("\r\n");
    return `${headers}\r\n${body}`;
}

// Helper function to compress data
function compressData(data, acceptEncoding) {
    let compressedData = Buffer.from(data);
    let contentEncodingHeader = "";

    if (acceptEncoding && acceptEncoding.includes("gzip")) {
        contentEncodingHeader = "gzip";
        compressedData = zlib.gzipSync(data);
    } else if (acceptEncoding && acceptEncoding.includes("deflate")) {
        contentEncodingHeader = "deflate";
        compressedData = zlib.deflateSync(data);
    } else if (acceptEncoding && acceptEncoding.includes("br")) {
        contentEncodingHeader = "br";
        compressedData = zlib.brotliCompressSync(data);
    }

    return [compressedData, contentEncodingHeader];
}

// Start the server
server.listen(4221, "localhost", () => {
    console.log("Server is listening on localhost:4221");
});