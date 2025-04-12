const net = require("net");
const fs = require("fs");
const zlib = require("zlib");

// Create a TCP server that listens to HTTP requests
const server = net.createServer((socket) => {
    let buffer = "";

    socket.on("data", (chunk) => {
        buffer += chunk.toString("utf8");

        // Check if the request is complete (headers and body are separated by \r\n\r\n)
        if (buffer.includes("\r\n\r\n")) {
            const request = buffer.trim();
            buffer = ""; // Reset the buffer for the next request

            const [response, shouldCloseConnection, contentEncodingHeader, compressedData] = handleHttpRequest(request);

            // Send the response
            socket.write(response);

            if (contentEncodingHeader) {
                socket.write(compressedData);
            }

            // Close the connection only if the client requests it
            if (shouldCloseConnection) {
                socket.end();
            }
        }
    });

    // Handle socket errors
    socket.on("error", (err) => {
        console.error("Socket error:", err);
        socket.end("HTTP/1.1 500 Internal Server Error\r\n\r\n");
    });

    // Log when a connection is closed
    socket.on("close", () => {
        console.log("Connection closed");
    });
});

// Function to handle HTTP requests
function handleHttpRequest(request) {
    const requestLines = request.split("\r\n");
    const [method, path] = requestLines[0].split(" ");
    const headers = parseHeaders(requestLines.slice(1));
    const body = requestLines.slice(requestLines.indexOf("") + 1).join("\r\n");

    const acceptEncoding = headers["Accept-Encoding"];
    const connectionHeader = headers["Connection"];
    const shouldClose = connectionHeader && connectionHeader.toLowerCase() === "close";

    // Serve files (GET /files/{filename})
    if (path.startsWith("/files/") && method === "GET") {
        const directory = process.argv[3];
        const filename = path.split("/files/")[1];
        const filePath = `${directory}/${filename}`;

        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, "utf8");
            const [compressedData, contentEncodingHeader] = compressData(data, acceptEncoding);
            const response = buildHttpResponse(200, "application/octet-stream", compressedData, contentEncodingHeader);
            return [response, shouldClose, contentEncodingHeader, compressedData];
        } else {
            return ["HTTP/1.1 404 Not Found\r\n\r\n", shouldClose, null];
        }
    }

    // Handle file upload (POST /files/{filename})
    if (path.startsWith("/files/") && method === "POST") {
        const directory = process.argv[3];
        const filename = path.split("/files/")[1];
        const filePath = `${directory}/${filename}`;

        try {
            fs.writeFileSync(filePath, body);
            return ["HTTP/1.1 201 Created\r\n\r\n", shouldClose, null];
        } catch (err) {
            return ["HTTP/1.1 500 Internal Server Error\r\n\r\n", shouldClose, null];
        }
    }

    // Serve User-Agent information (GET /user-agent)
    if (path === "/user-agent") {
        const userAgent = headers["User-Agent"] || "Unknown";
        const [compressedData, contentEncodingHeader] = compressData(userAgent, acceptEncoding);
        const response = buildHttpResponse(200, "text/plain", compressedData, contentEncodingHeader);
        return [response, shouldClose, contentEncodingHeader, compressedData];
    }

    // Serve echo endpoint (GET /echo/{text})
    if (path.startsWith("/echo/")) {
        const text = path.split("/echo/")[1] || "";
        const [compressedData, contentEncodingHeader] = compressData(text, acceptEncoding);
        const response = buildHttpResponse(200, "text/plain", compressedData, contentEncodingHeader);
        return [response, shouldClose, contentEncodingHeader, compressedData];
    }

    // Default response for invalid paths
    return ["HTTP/1.1 404 Not Found\r\n\r\n", shouldClose];
}

// Helper function to parse HTTP headers
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
function buildHttpResponse(statusCode, contentType, body, contentEncoding) {
    const statusMessage = statusCode === 200 ? "OK" : "Error";
    const headers = [
        `HTTP/1.1 ${statusCode} ${statusMessage}`,
        `Content-Type: ${contentType}`,
        `Content-Length: ${body.length}`,
        contentEncoding ? `Content-Encoding: ${contentEncoding}` : "",
        "\r\n"
    ].filter(Boolean).join("\r\n");
    return `${headers}${body}`;
}

// Helper function to compress data
function compressData(data, acceptEncoding) {
    let compressedData = Buffer.from(data);
    let contentEncodingHeader = "";

    if (acceptEncoding && acceptEncoding.includes("gzip")) {
        contentEncodingHeader = "gzip";
        compressedData = zlib.gzipSync(data); // Compress using gzip
    } else if (acceptEncoding && acceptEncoding.includes("deflate")) {
        contentEncodingHeader = "deflate";
        compressedData = zlib.deflateSync(data); // Compress using deflate
    } else if (acceptEncoding && acceptEncoding.includes("br")) {
        contentEncodingHeader = "br";
        compressedData = zlib.brotliCompressSync(data); // Compress using Brotli
    }

    return [compressedData, contentEncodingHeader];
}

// Start the server
server.listen(4221, "localhost", () => {
    console.log("Server is listening on localhost:4221");
});