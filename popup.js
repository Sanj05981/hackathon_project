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
});