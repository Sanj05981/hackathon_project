document.addEventListener("DOMContentLoaded", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currentTab = tabs[0];
        const panoptoUI = document.getElementById("panopto-ui");
        const otherUI = document.getElementById("other-ui");

        if (currentTab && currentTab.url.includes("https://uva.hosted.panopto.com/Panopto/Pages/Viewer.aspx")) {
            panoptoUI.style.display = "block";
        } else {
            otherUI.style.display = "block";
        }
    });

    const scrapeButton = document.getElementById("scrape-captions");
    const summarizeButton = document.getElementById("summarize-captions");

    if (scrapeButton) {
        scrapeButton.addEventListener("click", function () {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                const currentTab = tabs[0];
                const videoId = extractVideoId(currentTab.url);

                if (videoId) {
                    const transcriptionUrl = `https://uva.hosted.panopto.com/Panopto/Pages/Transcription/GenerateSRT.ashx?id=${videoId}&language=0&clean=true`;
                    chrome.scripting.executeScript({
                        target: { tabId: currentTab.id },
                        function: fetchTranscription,
                        args: [transcriptionUrl]
                    }, (results) => {
                        if (results && results[0] && results[0].result) {
                            const captionsElement = document.getElementById("captions");
                            captionsElement.textContent = results[0].result;
                        } else {
                            console.error("Failed to fetch transcription.");
                        }
                    });
                } else {
                    console.error("Video ID not found in the URL.");
                }
            });
        });
    }

    if (summarizeButton) {
        summarizeButton.addEventListener("click", function () {
            const captionsElement = document.getElementById("captions");
            const captionsText = captionsElement.textContent;
            if (captionsText) {
                summarizeText(captionsText);
            } else {
                document.getElementById("summary").textContent = "No captions available for summarization.";
            }
        });
    }

    function extractVideoId(url) {
        const match = url.match(/id=([a-f0-9-]+)/);
        return match ? match[1] : null;
    }

    function fetchTranscription(url) {
        return fetch(url)
            .then(response => response.text())
            .then(data => {
                return data;
            })
            .catch(error => {
                console.error("Error fetching transcription:", error);
                return "Failed to fetch transcription.";
            });
    }

    function summarizeText(text) {
        const apiKey = "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";  // Replace with your actual Groq API key
        const endpoint = "https://api.groq.com/openai/v1/chat/completions";

        // Split the text into smaller chunks (e.g., 2000 tokens per chunk)
        const chunkSize = 2000;  // Adjust based on the model's token limit
        const textChunks = splitTextIntoChunks(text, chunkSize);

        // Array to store summaries of each chunk
        const summaries = [];

        // Function to process each chunk
        const processChunk = (chunk) => {
            const requestBody = {
                model: "llama3-70b-8192",  // Updated model name
                messages: [
                    { "role": "system", "content": "Summarize the text into bullet points with key information only." },
                    { "role": "user", "content": chunk }
                ],
                max_tokens: 6000  // Adjust based on your needs
            };

            return fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.choices && data.choices.length > 0) {
                    return data.choices[0].message.content;
                } else {
                    throw new Error("No choices returned from the API.");
                }
            });
        };

        // Process all chunks sequentially
        const processAllChunks = async () => {
            for (const chunk of textChunks) {
                try {
                    const summary = await processChunk(chunk);
                    summaries.push(summary);
                } catch (error) {
                    console.error("Error processing chunk:", error);
                    summaries.push(`Error processing chunk: ${error.message}`);
                }
            }

            // Combine all summaries into a single result
            const finalSummary = summaries.join("\n");
            document.getElementById("summary").textContent = finalSummary;
        };

        // Start processing
        processAllChunks();
    }

    // Helper function to split text into chunks based on token limits
    function splitTextIntoChunks(text, chunkSize) {
        const chunks = [];
        let currentChunk = "";
        const words = text.split(" ");

        for (const word of words) {
            if ((currentChunk + word).length < chunkSize) {
                currentChunk += word + " ";
            } else {
                chunks.push(currentChunk.trim());
                currentChunk = word + " ";
            }
        }

        // Add the last chunk
        if (currentChunk.trim().length > 0) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }
});