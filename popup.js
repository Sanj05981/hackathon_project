document.addEventListener("DOMContentLoaded", function () {
    // State variables
    let globalTranscript = "";
    let chatHistory = [];
    
    // Hardcoded API key
    const apiKey = "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";
    
    /**
     * Update the state of the scrape button
     * @param {boolean} created - Whether PanoptoPal has been created for this video
     */
    function updateScrapeButtonState(created = false) {
        const scrapeButton = document.getElementById("scrape-captions");
        if (scrapeButton) {
            scrapeButton.disabled = created;
            
            if (created) {
                scrapeButton.textContent = "PanoptoPal Created";
                scrapeButton.classList.remove("bg-uva-orange");
                scrapeButton.classList.remove("hover:bg-uva-light-blue");
                scrapeButton.classList.add("bg-uva-light-blue");
                scrapeButton.classList.add("cursor-not-allowed");
                scrapeButton.classList.add("opacity-70");
            } else {
                scrapeButton.textContent = "Create PanoptoPal";
                scrapeButton.classList.remove("bg-uva-light-blue");
                scrapeButton.classList.remove("cursor-not-allowed");
                scrapeButton.classList.remove("opacity-70");
                scrapeButton.classList.add("bg-uva-orange");
                scrapeButton.classList.add("hover:bg-uva-light-blue");
            }
        }
    }
    
    /**
     * Show a notification to the user
     * @param {string} message - The message to display
     * @param {boolean} isError - Whether it's an error message
     */
    function showNotification(message, isError = false) {
        const captionsElement = document.getElementById("captions");
        if (captionsElement) {
            captionsElement.classList.remove("hidden");
            updateCaptionsDisplay(message, isError);
        }
    }
    
    /**
     * Update the captions display
     * @param {string} content - The content to display
     * @param {boolean} isError - Whether it's an error message
     */
    function updateCaptionsDisplay(content, isError) {
        const captionsElement = document.getElementById("captions");
        if (!captionsElement) {
            console.error("Captions element not found");
            return;
        }
        
        captionsElement.className = isError 
            ? "border border-red-500 rounded-md p-3 min-h-20 max-h-40 overflow-y-auto bg-red-50 text-red-800 mb-4" 
            : "border border-gray-300 rounded-md p-3 min-h-20 max-h-40 overflow-y-auto bg-uva-light-gray mb-4";
        
        captionsElement.textContent = content;
    }
    
    /**
     * Extract the video ID from the Panopto URL
     * @param {string} url - The URL to extract from
     * @returns {string|null} - The extracted video ID or null
     */
    function extractVideoId(url) {
        const match = url.match(/id=([a-f0-9-]+)/);
        return match ? match[1] : null;
    }
    
    /**
     * Clean SRT transcript format (remove timestamps and numbers)
     * @param {string} srtTranscript - The raw SRT transcript
     * @returns {string} - The cleaned transcript
     */
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
    
    /**
     * Add a message to the chat
     * @param {string} role - 'user' or 'assistant'
     * @param {string} content - The message content
     * @param {string} messageId - Optional ID for the message element
     * @returns {Object} - The message object
     */
    function addChatMessage(role, content, messageId) {
        const chatMessages = document.getElementById("chat-messages");
        if (!chatMessages) return null;
        
        const messageDiv = document.createElement("div");
        
        if (role === 'user') {
            messageDiv.className = "chat-message ml-auto mb-2 p-3 rounded-lg max-w-4/5 bg-uva-blue text-white";
            messageDiv.style.borderRadius = "18px 18px 4px 18px";
        } else {
            messageDiv.className = "chat-message mb-2 p-3 rounded-lg max-w-4/5 bg-white border border-gray-300";
            messageDiv.style.borderRadius = "18px 18px 18px 4px";
        }
        
        if (messageId) {
            messageDiv.id = messageId;
        }
        
        // Generate and store both raw and formatted content
        const formattedContent = messageId === "thinking-message" ? content : renderEnhancedMarkdown(content);
        messageDiv.innerHTML = formattedContent;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Return both versions for storage
        return {
            raw: content,
            formatted: messageDiv.innerHTML, // Store the actual HTML
            role: role
        };
    }
    
    /**
     * Render enhanced markdown
     * @param {string} text - The text to render
     * @returns {string} - The rendered HTML
     */
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
    
    /**
     * Remove all HTML tags from text
     * @param {string} text - The text to clean
     * @returns {string} - The cleaned text
     */
    function removeAllHTMLTags(text) {
        return text.replace(/<[^>]*>/g, '');
    }
    
    /**
     * Fetch the transcription for a video
     * @param {string} url - The transcription URL
     * @param {string} videoId - The video ID
     */
    function fetchTranscription(url, videoId) {
        updateScrapeButtonState(true); // Disable button immediately when clicked
        showNotification("Fetching transcript...", false);
        
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
                
                showNotification("Successfully Scraped Captions!", false);
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
                showNotification("Failed to fetch transcription: " + error.message, true);
                updateScrapeButtonState(false); // Re-enable on error
            });
    }
    
    /**
     * Load stored transcript for a video
     * @param {string} videoId - The video ID
     */
    function loadTranscript(videoId) {
        const storageKey = `transcript_${videoId}`;
        chrome.storage.local.get([storageKey, `processed_${videoId}`], function(result) {
            if (result[storageKey]) {
                console.log("Loading stored transcript");
                globalTranscript = result[storageKey];
                showNotification("Transcript loaded from storage.", false);
                
                // Check if this video was already processed
                if (result[`processed_${videoId}`]) {
                    updateScrapeButtonState(true);
                }
                
                createChatInterface();
            }
        });
    }
    
    /**
     * Save transcript to storage
     * @param {string} videoId - The video ID
     * @param {string} transcript - The transcript content
     */
    function saveTranscript(videoId, transcript) {
        const storageKey = `transcript_${videoId}`;
        const data = {};
        data[storageKey] = transcript;
        
        chrome.storage.local.set(data, function() {
            console.log("Transcript saved to storage");
        });
    }
    
    /**
     * Load chat history for a video
     * @param {string} videoId - The video ID
     */
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
    
    /**
     * Save chat history for a video
     * @param {string} videoId - The video ID
     */
    function saveChatHistory(videoId) {
        const storageKey = `chat_${videoId}`;
        const data = {};
        data[storageKey] = chatHistory;
        
        chrome.storage.local.set(data, function() {
            console.log("Chat history saved to storage");
        });
    }
    
    /**
     * Populate the chat with history
     */
    function populateChatHistory() {
        const chatMessages = document.getElementById("chat-messages");
        if (!chatMessages) return;
        
        chatMessages.innerHTML = "";
        
        chatHistory.forEach(message => {
            const messageDiv = document.createElement("div");
            
            if (message.role === 'user') {
                messageDiv.className = "chat-message ml-auto mb-2 p-3 rounded-lg max-w-4/5 bg-uva-blue text-white";
                messageDiv.style.borderRadius = "18px 18px 4px 18px";
            } else {
                messageDiv.className = "chat-message mb-2 p-3 rounded-lg max-w-4/5 bg-white border border-gray-300";
                messageDiv.style.borderRadius = "18px 18px 18px 4px";
            }
            
            // Use the stored formatted content if available
            messageDiv.innerHTML = message.formatted || renderEnhancedMarkdown(message.raw || message.content);
            chatMessages.appendChild(messageDiv);
        });
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    /**
     * Create the chat interface
     */
    function createChatInterface() {
        console.log("Creating chat interface");
        if (document.getElementById("chat-container")) {
            document.getElementById("chat-container").style.display = "block";
            populateChatHistory();
            return;
        }
        
        // Clone the template
        const template = document.getElementById("chat-template");
        const chatContainer = template.content.cloneNode(true);
        
        // Find a good place to insert the chat container
        const panoptoUI = document.getElementById("panopto-ui");
        panoptoUI.appendChild(chatContainer);
        
        // Add event listeners for chat functionality
        const sendButton = document.getElementById("send-button");
        const chatInput = document.getElementById("chat-input");
        const clearButton = document.getElementById("clear-chat");
        
        sendButton.addEventListener("click", sendChatMessage);
        chatInput.addEventListener("keypress", function(e) {
            if (e.key === "Enter") {
                sendChatMessage();
            }
        });
        clearButton.addEventListener("click", clearChat);
        
        // Populate with existing chat history
        populateChatHistory();
    }
    
    /**
     * Clear chat
     */
    function clearChat() {
        const chatMessages = document.getElementById("chat-messages");
        if (chatMessages) {
            chatMessages.innerHTML = "";
            
            // Reset chat history but keep initial welcome message
            const welcomeMessage = addChatMessage("assistant", "Hi! I've analyzed the transcript. What questions do you have about the content?");
            chatHistory = [welcomeMessage];
            
            // Save the cleared chat history
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                const currentTab = tabs[0];
                const videoId = extractVideoId(currentTab.url);
                if (videoId) {
                    saveChatHistory(videoId);
                }
            });
        }
    }
    
    /**
     * Send a chat message
     */
    function sendChatMessage() {
        const chatInput = document.getElementById("chat-input");
        const userMessage = chatInput.value.trim();
        
        if (!userMessage) return;
        
        // Add user message and get the message object with both versions
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
        const thinkingMessage = addChatMessage("assistant", 
            `<img src="uva_panopto_white_bg.png" class="thinking-spinner h-6 w-6 inline-block mr-2" alt="Loading">Thinking...`, 
            "thinking-message"
        );
        
        // Use the hardcoded API key directly - no prompting
        askGroqAboutTranscript(userMessage, globalTranscript, apiKey);
    }
    
    /**
     * Use Groq API to summarize the transcript
     * @param {string} transcript - The transcript to summarize
     */
    function summarizeWithGroq(transcript) {
        console.log("Starting Groq API request for summarization");
        
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
    
    /**
     * Ask Groq AI about the transcript
     * @param {string} question - The user's question
     * @param {string} transcript - The transcript to search
     * @param {string} apiKey - The Groq API key
     */
    function askGroqAboutTranscript(question, transcript, apiKey) {
        console.log("Asking Groq about the transcript");
        
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
                'Authorization': `Bearer ${apiKey}`
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
                
                // Remove thinking message from history if it was added
                const thinkingIndex = chatHistory.findIndex(msg => msg.formatted && msg.formatted.includes("thinking-message"));
                if (thinkingIndex !== -1) {
                    chatHistory.splice(thinkingIndex, 1);
                }
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
            
            // Remove thinking message
            const thinkingMessage = document.getElementById("thinking-message");
            if (thinkingMessage) {
                thinkingMessage.remove();
                
                // Remove thinking message from history if it was added
                const thinkingIndex = chatHistory.findIndex(msg => msg.formatted && msg.formatted.includes("thinking-message"));
                if (thinkingIndex !== -1) {
                    chatHistory.splice(thinkingIndex, 1);
                }
            }
            
            // Add error message
            addChatMessage("assistant", `Error getting answer: ${error.message}`);
        });
    }
    
    // Initialize UI based on current tab
    function initializeUI() {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const currentTab = tabs[0];
            const panoptoUI = document.getElementById("panopto-ui");
            const otherUI = document.getElementById("other-ui");

            if (currentTab && currentTab.url && currentTab.url.includes("https://uva.hosted.panopto.com/Panopto/Pages/Viewer.aspx")) {
                panoptoUI.classList.remove("hidden");
                
                const videoId = extractVideoId(currentTab.url);
                if (videoId) {
                    loadTranscript(videoId);
                    loadChatHistory(videoId);
                }
            } else {
                otherUI.classList.remove("hidden");
                panoptoUI.classList.add("hidden");
            }
        });
    }
    
    /**
     * Handle scrape button click
     */
    function handleScrapeButtonClick() {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const currentTab = tabs[0];
            const videoId = extractVideoId(currentTab.url);

            if (videoId) {
                const transcriptionUrl = `https://uva.hosted.panopto.com/Panopto/Pages/Transcription/GenerateSRT.ashx?id=${videoId}&language=0&clean=true`;
                fetchTranscription(transcriptionUrl, videoId);
            } else {
                console.error("Video ID not found in the URL.");
                showNotification("Error: Video ID not found in the URL.", true);
            }
        });
    }
    
    /**
     * Handle summarize button click
     */
    function handleSummarizeButtonClick() {
        console.log("Summarize button clicked");
        
        if (!globalTranscript || globalTranscript.trim() === "") {
            showNotification("Please scrape captions first before summarizing.", true);
            return;
        }
        
        const captionsDisplay = document.getElementById("captions");
        if (captionsDisplay) {
            captionsDisplay.classList.remove("hidden");
            updateCaptionsDisplay("Generating summary... Please wait...", false);
        }
        
        // Use the hardcoded API key directly - no prompting
        summarizeWithGroq(globalTranscript);
    }
    
    /**
     * Set up event listeners for UI elements
     */
    function setupEventListeners() {
        // Scrape captions button
        const scrapeButton = document.getElementById("scrape-captions");
        if (scrapeButton) {
            scrapeButton.addEventListener("click", handleScrapeButtonClick);
        }
        
        // Summarize captions button
        const summarizeButton = document.getElementById("summarize-captions");
        if (summarizeButton) {
            summarizeButton.addEventListener("click", handleSummarizeButtonClick);
        }
    }
    
    // Initialize UI and set up event listeners
    initializeUI();
    setupEventListeners();
});