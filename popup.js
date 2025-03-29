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
                    fetchTranscription(transcriptionUrl);
                } else {
                    console.error("Video ID not found in the URL.");
                }
            });
        });
    }
    // Summarize button actions 
    if (summarizeButton) {
        summarizeButton.addEventListener("click", function () {
            if (lastTranscription) {
                summarizeText(lastTranscription);
            } else {
                document.getElementById("summary").textContent = "No captions available for summarization.";
            }
        });
    }

    // Function to extract the video ID from the Panopto URL
    function extractVideoId(url) {
        const match = url.match(/id=([a-f0-9-]+)/);
        return match ? match[1] : null;
    }

    // Function to fetch the transcription content
    function fetchTranscription(url) {
        fetch(url)
            .then(response => response.text())
            .then(data => {
                console.log("Transcription Content:", data);
                const captionsElement = document.getElementById("captions");
                captionsElement.textContent = data;
            })
            .catch(error => {
                console.error("Error fetching transcription:", error);
                const captionsElement = document.getElementById("captions");
                captionsElement.textContent = "Failed to fetch transcription.";
            });
    }
    // AI function to summarize the text
    function summarizeText(text) {
        const apiKey = "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";  
        const endpoint = "https://api.groq.com/v1/chat/completions";

        const requestBody = {
            model: "llama3-8b-3192",  
            messages: [
                { "role": "system", "content": "Summarize the text into bullet points with key information only." },
                { "role": "user", "content": text }
            ],
            max_tokens: 200
        };

        fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${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}`
            },
            body: JSON.stringify(requestBody)
        })
        .then(response => response.json())
        .then(data => {
            if (data.choices && data.choices.length > 0) {
                document.getElementById("summary").textContent = data.choices[0].message.content;
            } else {
                document.getElementById("summary").textContent = "Failed to generate summary.";
            }
        })
        .catch(error => {
            console.error("Error calling Groq API:", error);
            document.getElementById("summary").textContent = "Error generating summary.";
        });
    }
});