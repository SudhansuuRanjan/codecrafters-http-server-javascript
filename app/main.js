const net = require("net");
const fs = require("fs");
const zlib = require("zlib");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

const compressData = (data, acceptEncoding) => {
    let compressedData = "";
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

    return [data, contentEncodingHeader];
}

// Uncomment this to pass the first stage
const server = net.createServer((socket) => {
    socket.on("data", (chunk) => {
        const request = chunk.toString("utf8").trim();
        const requestLines = request.split("\r\n");
        const requestLine = requestLines[0].split(" ");
        const path = requestLine[1];
        const method = requestLine[0];
        // const protocol = requestLine[2];
        const headers = requestLines.slice(1).reduce((acc, line) => {
            const [key, value] = line.split(": ");
            acc[key] = value;
            return acc;
        }, {});

        const contentEncoding = headers["Content-Encoding"];
        const acceptEncoding = headers["Accept-Encoding"];

        const body = requestLines.slice(requestLines.indexOf("") + 1).join("\r\n");

        if (path.startsWith("/files/") && method === "GET") {
            const directory = process.argv[3];
            const filename = path.split("/files/")[1];
            const filePath = `${directory}${filename}`;

            if (fs.existsSync(filePath)) {
                // read the file and return the content
                const data = fs.readFileSync(filePath).toString();
                const [compressedData, contentEncodingHeader] = compressData(data, acceptEncoding);
                const response = `HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream${contentEncodingHeader && `\r\nContent-Encoding: ${contentEncodingHeader}`}\r\nContent-Length: ${compressedData.length}\r\n\r\n${compressedData}`;
                socket.write(response);
                return;

            } else {
                const response = "HTTP/1.1 404 Not Found\r\n\r\n";
                socket.write(response);
            }
            return;
        }

        if (path.startsWith("/files/") && method === "POST") {
            const directory = process.argv[3];
            const filename = path.split("/files/")[1];
            const filePath = `${directory}${filename}`;

            // create the file and write the body to it
            fs.writeFileSync(filePath, body);
            const response = "HTTP/1.1 201 Created\r\n\r\n";
            socket.write(response);
            return;
        }

        let user_agent = headers["User-Agent"];

        if (user_agent) {
            const [compressedData, contentEncodingHeader] = compressData(user_agent, acceptEncoding);
            const response = `HTTP/1.1 200 OK\r\nContent-Type: text/plain${contentEncodingHeader && `\r\nContent-Encoding: ${contentEncodingHeader}`}\r\nContent-Length: ${compressedData.length}\r\n\r\n${compressedData}`;
            socket.write(response);
            return;
        }


        if (path === "/") {
            const response = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 0\r\n\r\n";
            socket.write(response);
            return;
        }

        // get text from the path (/echo/{string}) also add a check if the path is valid
        if (!path.startsWith("/echo")) {
            const response = "HTTP/1.1 404 Not Found\r\n\r\n";
            socket.write(response);
            return;
        }

        let text = path.split("/")[2] || "";
        const [compressedData, contentEncodingHeader] = compressData(text, acceptEncoding);
        const response = `HTTP/1.1 200 OK\r\nContent-Type: text/plain${contentEncodingHeader && `\r\nContent-Encoding: ${contentEncodingHeader}`}\r\nContent-Length: ${compressedData.length}\r\n\r\n${compressedData}`;
        socket.write(response);
    });

    socket.on("close", () => {
        socket.end();
    });
});

server.listen(4221, "localhost");
