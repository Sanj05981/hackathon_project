document.addEventListener("DOMContentLoaded", function () {
    let globalTranscript = "";
    let chatHistory = [];
    
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currentTab = tabs[0];
        const panoptoUI = document.getElementById("panopto-ui");
        const otherUI = document.getElementById("other-ui");

        if (currentTab && currentTab.url.includes("https://uva.hosted.panopto.com/Panopto/Pages/Viewer.aspx")) {
        panoptoUI.style.display = "block";
        document.body.style.width = "400px"; // Standard width
        document.body.style.fontSize = "14px";
        
        const videoId = extractVideoId(currentTab.url);
        if (videoId) {
            loadTranscript(videoId);
            loadChatHistory(videoId);
        }
    } else {
        otherUI.style.display = "block";
        panoptoUI.style.display = "none";
        document.body.style.width = "350px"; // Slightly narrower for message
        document.body.style.fontSize = "15px"; // Slightly larger for message
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
                    fetchTranscription(transcriptionUrl, videoId);
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
            
            updateCaptionsDisplay("Generating summary... Please wait...", false);
            
            const groqApiKey = "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"; 
            
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

    // Function to load stored transcript
    function loadTranscript(videoId) {
        const storageKey = `transcript_${videoId}`;
        chrome.storage.local.get([storageKey, `processed_${videoId}`], function(result) {
            if (result[storageKey]) {
                console.log("Loading stored transcript");
                globalTranscript = result[storageKey];
                updateCaptionsDisplay("Transcript loaded from storage.", false);
                
                // Check if this video was already processed
                if (result[`processed_${videoId}`]) {
                    updateScrapeButtonState(true);
                }
                
                createChatInterface();
            }
        });
    }
    
    // Function to save transcript to storage
    function saveTranscript(videoId, transcript) {
        const storageKey = `transcript_${videoId}`;
        const data = {};
        data[storageKey] = transcript;
        
        chrome.storage.local.set(data, function() {
            console.log("Transcript saved to storage");
        });
    }
    
    // Function to load chat history
    function loadChatHistory(videoId) {
        const storageKey = `chat_${videoId}`;
        chrome.storage.local.get([storageKey], function(result) {
            if (result[storageKey]) {
                console.log("Loading stored chat history");
                chatHistory = result[storageKey];
                
                // If chat interface exists, populate it with history
                const chatMessages = document.getElementById("chat-messages");
                if (chatMessages) {
                    populateChatHistory();
                }
            } else {
                chatHistory = [];
            }
        });
    }
    
    // Function to save chat history
    function saveChatHistory(videoId) {
        const storageKey = `chat_${videoId}`;
        const data = {};
        data[storageKey] = chatHistory;
        
        chrome.storage.local.set(data, function() {
            console.log("Chat history saved to storage");
        });
    }
    
    // Function to populate chat with history
    function populateChatHistory() {
        const chatMessages = document.getElementById("chat-messages");
        if (!chatMessages) return;
        
        chatMessages.innerHTML = "";
        
        chatHistory.forEach(message => {
            const messageDiv = document.createElement("div");
            messageDiv.className = `chat-message ${message.role}-message`;
            
            messageDiv.style.cssText = `
                margin-bottom: 10px;
                padding: 8px 12px;
                border-radius: 18px;
                max-width: 80%;
                ${message.role === 'user' ? 
                    'background-color: #e3f2fd; margin-left: auto; text-align: right;' : 
                    'background-color: #f1f0f0;'}
            `;
            
            // Use the stored formatted content if available
            messageDiv.innerHTML = message.formatted || renderEnhancedMarkdown(message.raw || message.content);
            chatMessages.appendChild(messageDiv);
        });
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Function to fetch the transcription content
    function fetchTranscription(url, videoId) {
        updateScrapeButtonState(true); // Disable button immediately when clicked
        updateCaptionsDisplay("Fetching transcript...", false);
        
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    updateScrapeButtonState(false); // Re-enable if error
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.text();
            })
            .then(data => {
                console.log("Transcription Content Length:", data.length);
                globalTranscript = cleanTranscript(data);
                saveTranscript(videoId, globalTranscript);
                
                // Mark this video as processed
                chrome.storage.local.set({ [`processed_${videoId}`]: true }, () => {
                    console.log("Marked video as processed");
                });
                
                updateCaptionsDisplay("Successfully Scraped Captions!", false);
                updateScrapeButtonState(true); // Ensure button stays disabled
                
                createChatInterface();
                
                // Initialize chat history if empty
                if (chatHistory.length === 0) {
                    const welcomeMessage = addChatMessage("assistant", "Hi! I've analyzed the transcript. What questions do you have about the content?");
                    chatHistory.push(welcomeMessage);
                    saveChatHistory(videoId);
                }
            })
            .catch(error => {
                console.error("Error fetching transcription:", error);
                updateCaptionsDisplay("Failed to fetch transcription: " + error.message, true);
                updateScrapeButtonState(false); // Re-enable on error
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
            return srtTranscript; 
        }
    }

    // Function to summarize transcript using Groq API
    function summarizeWithGroq(transcript, apiKey) {
        console.log("Starting Groq API request for summarization");
        if (!apiKey) {
            console.error("Groq API key not provided");
            updateCaptionsDisplay("Error: API key not provided. Please set your Groq API key in the extension.", true);
            return;
        }
        
        // Limit transcript length if too long (API may have limits)
        const maxLength = 16000; 
        const truncatedTranscript = transcript.length > maxLength 
            ? transcript.substring(0, maxLength) + "... (truncated for API limits)"
            : transcript;
            
        const requestData = {
            model: 'gemma2-9b-it', 
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
    function createChatInterface() {
        console.log("Creating chat interface");
        if (document.getElementById("chat-container")) {
            document.getElementById("chat-container").style.display = "block";
            populateChatHistory();
            document.body.style.height = "600px";
            return;
        }
        
        const chatContainer = document.createElement("div");
        chatContainer.id = "chat-container";
        chatContainer.style.cssText = `
            margin-top: 20px;
            border: 1px solid #ccc;
            border-radius: 8px;
            overflow: hidden;
            font-family: Arial, sans-serif;
        `;
        
        const chatTitle = document.createElement("div");
        chatTitle.style.cssText = `
            background-color: #f0f0f0;
            padding: 10px;
            font-weight: bold;
            border-bottom: 1px solid #ccc;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

        // Title text
        const titleText = document.createElement("span");
        titleText.textContent = "Ask questions about this video";
        chatTitle.appendChild(titleText);

        // Clear button
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
        
        // Populate with existing chat history or add initial message
        if (chatHistory.length > 0) {
            populateChatHistory();
        } else {
            // Initial assistant message - now returns formatted message object
            const welcomeMessage = addChatMessage("assistant", "Hi! I've analyzed the transcript. What questions do you have about the content?");
            
            // Add to history and save it (now includes formatted HTML)
            chatHistory.push(welcomeMessage);
            
            // Save the initial message
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                const currentTab = tabs[0];
                const videoId = extractVideoId(currentTab.url);
                if (videoId) {
                    saveChatHistory(videoId);
                }
            });
        }
    }
    
    // Clear chat function
    function clearChat() {
        const chatMessages = document.getElementById("chat-messages");
        if (chatMessages) {
            chatMessages.innerHTML = "";
            
            // Reset chat history but keep initial welcome message
            chatHistory = [{
                role: "assistant",
                content: "Hi! I've analyzed the transcript. What questions do you have about the content?"
            }];
            
            // Add back the initial assistant message
            addChatMessage("assistant", "Hi! I've analyzed the transcript. What questions do you have about the content?");
            
            // Save the cleared chat history
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                const currentTab = tabs[0];
                const videoId = extractVideoId(currentTab.url);
                if (videoId) {
                    saveChatHistory(videoId);
                }
            });
            
            // Don't reset the button state here - keep it disabled if PanoptoPal was created
        }
    }
    
    // Function to send chat message
    function sendChatMessage() {
        const chatInput = document.getElementById("chat-input");
        const userMessage = chatInput.value.trim();
        
        if (!userMessage) return;
        
        // Add message and get the message object with both versions
        const messageObj = addChatMessage("user", userMessage);
        
        // Add to history
        chatHistory.push(messageObj);
        
        // Save updated history
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            const currentTab = tabs[0];
            const videoId = extractVideoId(currentTab.url);
            if (videoId) {
                saveChatHistory(videoId);
            }
        });
        
        // Clear input
        chatInput.value = "";
        
        // Show thinking message
        const thinkingMessage = addChatMessage("assistant", "Thinking...", "thinking-message");
        chatHistory.push(thinkingMessage);
        
        askGroqAboutTranscript(userMessage, globalTranscript);
    }
    
    function updateScrapeButtonState(created = false) {
        const scrapeButton = document.getElementById("scrape-captions");
        if (scrapeButton) {
            scrapeButton.disabled = created;
            scrapeButton.textContent = created ? "PanoptoPal Created" : "Create PanoptoPal";
            scrapeButton.style.backgroundColor = created ? "#87CEFA" : "#4285f4"; // Green when created
            // Remove any existing hover effects
            scrapeButton.onmouseenter = null;
            scrapeButton.onmouseleave = null;
            
            if (!created) {
                // Restore normal hover effects for enabled state
                scrapeButton.onmouseenter = () => {
                    scrapeButton.style.backgroundColor = "#357ae8";
                };
                scrapeButton.onmouseleave = () => {
                    scrapeButton.style.backgroundColor = "#4285f4";
                };
            }
        }
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
        
        // Special handling for thinking message
        if (messageId === "thinking-message") {
            messageDiv.classList.add("thinking-message");
            messageDiv.innerHTML = `
                <img src="uva_panopto_white_bg.png" class="thinking-spinner" alt="Loading">
                ${content}
            `;
        } else {
            // Generate and store both raw and formatted content
            const formattedContent = renderEnhancedMarkdown(content);
            messageDiv.innerHTML = formattedContent;
        }
        
        chatMessages.appendChild(messageDiv);
        
        // Return both versions for storage
        return {
            raw: content,
            formatted: messageDiv.innerHTML, // Store the actual HTML
            role: role
        };
    }
    function renderEnhancedMarkdown(text) {
        if (!text) return '';
        
        // First remove ALL HTML tags from the input
        const cleanText = removeAllHTMLTags(text);
        
        // Normalize all line breaks
        let result = cleanText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // Process code blocks (triple backticks)
        result = result.replace(/```([\s\S]*?)```/g, function(match, code) {
            return '<pre><code>' + code.trim() + '</code></pre>';
        });
        
        // Process inline code (single backticks)
        result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Process bold text (double asterisks)
        result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // Process italic text (single asterisks)
        result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        // Process bullet points (lines starting with *, -, or +)
        result = result.replace(/^[\*\-+]\s+(.*$)/gm, '• $1');
        
        // Process paragraphs and line breaks
        result = result.split('\n\n').map(paragraph => {
            const trimmed = paragraph.trim();
            if (!trimmed) return '';
            return '<p>' + trimmed.replace(/\n/g, '<br>') + '</p>';
        }).join('');
        
        return result;
    }
    
    function removeAllHTMLTags(text) {
        return text.replace(/<[^>]*>/g, '');
    }
    
    // Function to replace a specific message
    function replaceMessage(messageId, newContent) {
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            messageElement.textContent = newContent;
        }
    }
    
    // Function to ask Groq about the transcript
    function askGroqAboutTranscript(question, transcript) {
        console.log("Asking Groq about the transcript");
        
        const groqApiKey = "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"; 
        
        if (!groqApiKey) {
            replaceMessage("thinking-message", "Error: API key not provided.");
            return;
        }
        
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

// Remove "Thinking..." placeholder
const thinkingMessage = document.getElementById("thinking-message");
if (thinkingMessage) {
    thinkingMessage.remove();
    chatHistory.pop(); // Remove the thinking message from history
}

// Add the answer to UI and history
const answerMessage = addChatMessage("assistant", answer);
chatHistory.push(answerMessage);

// Save updated history
chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const currentTab = tabs[0];
    const videoId = extractVideoId(currentTab.url);
    if (videoId) {
        saveChatHistory(videoId);
    }
});
        })
        .catch(error => {
            console.error("Error with Groq API chat:", error);
            replaceMessage("thinking-message", `Error getting answer: ${error.message}`);
        });
    }
});