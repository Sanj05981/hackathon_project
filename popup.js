document.addEventListener("DOMContentLoaded", function () {
    // Store the transcript globally so it's accessible for the chat
    let globalTranscript = "";
    
    // Set up UI toggle based on URL
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

    // Scrape captions button event handler
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
                    updateCaptionsDisplay("Error: Video ID not found in the URL.", true);
                }
            });
        });
    }

    // Summarize captions button event handler
    const summarizeButton = document.getElementById("summarize-captions");
    if (summarizeButton) {
        summarizeButton.addEventListener("click", function() {
            console.log("Summarize button clicked");
            
            if (!globalTranscript || globalTranscript.trim() === "") {
                updateCaptionsDisplay("Please scrape captions first before summarizing.", true);
                return;
            }
            
            // Show loading state
            updateCaptionsDisplay("Generating summary... Please wait...", false);
            
            // Define API key within this function's scope to avoid reference errors
            const groqApiKey = "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"; // Example key (not real)
            
            

            summarizeWithGroq(globalTranscript, groqApiKey);
        });
    } else {
        console.error("Summarize button not found in DOM");
    }

    // Function to extract the video ID from the Panopto URL
    function extractVideoId(url) {
        const match = url.match(/id=([a-f0-9-]+)/);
        return match ? match[1] : null;
    }

    // Function to fetch the transcription content
    function fetchTranscription(url) {
        updateCaptionsDisplay("Fetching transcript...", false);
        
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.text();
            })
            .then(data => {
                console.log("Transcription Content Length:", data.length);
                // Clean the transcript and store it globally
                globalTranscript = cleanTranscript(data);
                // Update the captions display
                updateCaptionsDisplay("Successfully Scraped Captions!", false);
                //updateCaptionsDisplay("", false);
                //document.getElementById('captions').remove();
                // Create and show the chat interface
                createChatInterface();
            })
            .catch(error => {
                console.error("Error fetching transcription:", error);
                updateCaptionsDisplay("Failed to fetch transcription: " + error.message, true);
            });
    }

    // Helper function to update the captions display
    function updateCaptionsDisplay(content, isError) {
        const captionsElement = document.getElementById("captions");
        if (!captionsElement) {
            console.error("Captions element not found");
            return;
        }
        
        if (isError) {
            captionsElement.style.color = "red";
        } else {
            captionsElement.style.color = "black";
        }
        
        captionsElement.textContent = content;
    }

    // Clean SRT transcript format (remove timestamps and numbers)
    function cleanTranscript(srtTranscript) {
        try {
            // Enhanced regex to better handle SRT format
            return srtTranscript
                .replace(/^\d+$/gm, '') // Remove sequence numbers
                .replace(/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/g, '') // Remove timestamps
                .replace(/^\s*[\r\n]/gm, '') // Remove empty lines
                .trim();
        } catch (error) {
            console.error("Error cleaning transcript:", error);
            return srtTranscript; // Return original if there's an error
        }
    }

    // Function to summarize transcript using Groq API
    function summarizeWithGroq(transcript, apiKey) {
        console.log("Starting Groq API request for summarization");
        
        // Check if API key is set
        if (!apiKey) {
            console.error("Groq API key not provided");
            updateCaptionsDisplay("Error: API key not provided. Please set your Groq API key in the extension.", true);
            return;
        }
        
        // Limit transcript length if too long (API may have limits)
        const maxLength = 16000; // Maximum length for API input
        const truncatedTranscript = transcript.length > maxLength 
            ? transcript.substring(0, maxLength) + "... (truncated for API limits)"
            : transcript;
            
        const requestData = {
            model: 'gemma2-9b-it', // Or another Groq model
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant that summarizes lecture transcripts. Create a concise summary with key points only using regular text formatting with bullet points (•). Use the format: • Point 1\n• Point 2. Do not include any HTML, markdown, or styling. Do not include introduction text, just the direct bullet points of key information.'
                },
                {
                    role: 'user',
                    content: `Please summarize the following lecture transcript and provide only the key points with bullet points:\n\n${truncatedTranscript}`
                }
            ],
            temperature: 0.3,
            max_tokens: 1024
        };
        
        fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestData)
        })
        .then(response => {
            console.log("Received response from Groq API:", response.status);
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`API error (${response.status}): ${text}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log("Groq API success");
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error("Unexpected API response format");
            }
            
            const summary = data.choices[0].message.content;
            updateCaptionsDisplay(summary, false);
        })
        .catch(error => {
            console.error("Error with Groq API:", error);
            updateCaptionsDisplay("Failed to generate summary. Error: " + error.message, true);
        });
    }
    
    // Function to create chat interface
    // Function to create chat interface
    function createChatInterface() {
        console.log("Creating chat interface");
        
        // Check if chat container already exists
        if (document.getElementById("chat-container")) {
            document.getElementById("chat-container").style.display = "block";
            // Adjust popup height
            document.body.style.height = "600px";
            return;
        }
        
        // Create chat container
        const chatContainer = document.createElement("div");
        chatContainer.id = "chat-container";
        chatContainer.style.cssText = `
            margin-top: 20px;
            border: 1px solid #ccc;
            border-radius: 8px;
            overflow: hidden;
            font-family: Arial, sans-serif;
        `;
        
        // Chat title with clear button
        const chatTitle = document.createElement("div");
        const titleText = document.createElement("span");
        titleText.textContent = "Ask questions about this video";
        chatTitle.style.cssText = `
            background-color: #f0f0f0;
            padding: 10px;
            font-weight: bold;
            border-bottom: 1px solid #ccc;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        
        // Clear button (styled like send button)
        const clearButton = document.createElement("button");
        clearButton.textContent = "Clear";
        clearButton.title = "Clear chat";
        clearButton.style.cssText = `
            background-color: #FF0000;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            transition: background-color 0.2s;
        `;
        clearButton.addEventListener("mouseenter", () => {
            clearButton.style.backgroundColor = "#bf0000";
        });
        clearButton.addEventListener("mouseleave", () => {
            clearButton.style.backgroundColor = "#FF0000";
        });
        clearButton.addEventListener("click", clearChat);
        
        chatTitle.appendChild(titleText);
        chatTitle.appendChild(clearButton);
        chatContainer.appendChild(chatTitle);
        
        // Chat messages area
        const chatMessages = document.createElement("div");
        chatMessages.id = "chat-messages";
        chatMessages.style.cssText = `
            height: 250px;
            overflow-y: auto;
            padding: 10px;
            background-color: #f9f9f9;
        `;
        chatContainer.appendChild(chatMessages);
        
        // Input area
        const inputContainer = document.createElement("div");
        inputContainer.style.cssText = `
            display: flex;
            padding: 10px;
            border-top: 1px solid #ccc;
            background-color: #fff;
        `;
        
        const chatInput = document.createElement("input");
        chatInput.id = "chat-input";
        chatInput.type = "text";
        chatInput.placeholder = "Type your question here...";
        chatInput.style.cssText = `
            flex-grow: 1;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            margin-right: 8px;
        `;
        
        const sendButton = document.createElement("button");
        sendButton.textContent = "Send";
        sendButton.style.cssText = `
            background-color: #4285f4;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
        `;
        
        inputContainer.appendChild(chatInput);
        inputContainer.appendChild(sendButton);
        chatContainer.appendChild(inputContainer);
        
        // Find a good place to insert the chat container
        const panoptoUI = document.getElementById("panopto-ui");
        panoptoUI.appendChild(chatContainer);
        
        // Adjust the popup height to accommodate the chat interface
        document.body.style.height = "600px";
        
        // Add event listeners for chat functionality
        sendButton.addEventListener("click", sendChatMessage);
        chatInput.addEventListener("keypress", function(e) {
            if (e.key === "Enter") {
                sendChatMessage();
            }
        });
        
        // Initial assistant message
        addChatMessage("assistant", "Hi! I've analyzed the transcript. What questions do you have about the content?");
    }
    
    // Clear chat function
    function clearChat() {
        const chatMessages = document.getElementById("chat-messages");
        if (chatMessages) {
            chatMessages.innerHTML = "";
            // Add back the initial assistant message
            addChatMessage("assistant", "Hi! I've analyzed the transcript. What questions do you have about the content?");
        }
    }
    
    // Function to send chat message
    function sendChatMessage() {
        const chatInput = document.getElementById("chat-input");
        const userMessage = chatInput.value.trim();
        
        if (!userMessage) return;
        
        // Add user message to chat
        addChatMessage("user", userMessage);
        
        // Clear input
        chatInput.value = "";
        
        // Show thinking message
        addChatMessage("assistant", "Thinking...", "thinking-message");
        
        // Send to API
        askGroqAboutTranscript(userMessage, globalTranscript);
    }
    
    // Function to add message to chat
    function addChatMessage(role, content, messageId) {
        const chatMessages = document.getElementById("chat-messages");
        const messageDiv = document.createElement("div");
        messageDiv.className = `chat-message ${role}-message`;
        if (messageId) {
            messageDiv.id = messageId;
        }
        
        messageDiv.style.cssText = `
            margin-bottom: 10px;
            padding: 8px 12px;
            border-radius: 18px;
            max-width: 80%;
            ${role === 'user' ? 
                'background-color: #e3f2fd; margin-left: auto; text-align: right;' : 
                'background-color: #f1f0f0;'}
        `;
        
        messageDiv.textContent = content;
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Function to replace a specific message (used for the "thinking" message)
    function replaceMessage(messageId, newContent) {
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            messageElement.textContent = newContent;
        }
    }
    
    // Function to ask Groq about the transcript
    function askGroqAboutTranscript(question, transcript) {
        console.log("Asking Groq about the transcript");
        
        // API key
        const groqApiKey = "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"; 
        
        // Check if API key is set
        if (!groqApiKey) {
            replaceMessage("thinking-message", "Error: API key not provided.");
            return;
        }
        
        // Limit transcript length if too long
        const maxLength = 16000;
        const truncatedTranscript = transcript.length > maxLength 
            ? transcript.substring(0, maxLength) + "... (truncated for API limits)"
            : transcript;
            
        const requestData = {
            model: 'gemma2-9b-it',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant that answers questions about lecture content. Use only the information provided in the transcript to answer. If the answer cannot be found in the transcript, say so clearly. Be concise and accurate.'
                },
                {
                    role: 'user',
                    content: `Here is a lecture transcript:\n\n${truncatedTranscript}\n\nQuestion: ${question}`
                }
            ],
            temperature: 0.3,
            max_tokens: 1024
        };
        
        fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqApiKey}`
            },
            body: JSON.stringify(requestData)
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`API error (${response.status}): ${text}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error("Unexpected API response format");
            }
            
            const answer = data.choices[0].message.content;
            
            // Replace thinking message with the actual answer
            const thinkingMessage = document.getElementById("thinking-message");
            if (thinkingMessage) {
                thinkingMessage.remove();
            }
            
            // Add the answer
            addChatMessage("assistant", answer);
        })
        .catch(error => {
            console.error("Error with Groq API chat:", error);
            
            // Replace thinking message with error
            replaceMessage("thinking-message", `Error getting answer: ${error.message}`);
        });
    }
});