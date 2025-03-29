chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "transcribe") {
      // Securely fetch transcription data from the API
      fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.data)  // request.data holds any data to send
      })
        .then(response => response.json())
        .then(result => {
          // Send the API result back to popup.js
          sendResponse({ success: true, data: result });
        })
        .catch(error => {
          console.error("Transcription API error:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true;  // Keep the message channel open for sendResponse&#8203;:contentReference[oaicite:5]{index=5}
    }
  });
  