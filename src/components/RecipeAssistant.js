import React, { useState, useRef, useEffect } from 'react';

const RecipeAssistant = () => {
  const [ingredients, setIngredients] = useState('');
  const [dietary, setDietary] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentRecipe, setCurrentRecipe] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatMessagesRef = useRef(null);
  
  // Get API key from environment variable
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    // Check if API key is configured
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      console.error('OpenAI API key is not configured. Please add it to your .env file.');
    }
  }, [apiKey]);

  const callOpenAI = async (prompt, isRecipe = false) => {
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      throw new Error('OpenAI API key is not configured. Please add REACT_APP_OPENAI_API_KEY to your .env file.');
    }

    const systemPrompt = isRecipe 
      ? 'You are a helpful cooking assistant. When generating recipes, always format your response as a JSON object with the following structure: {"title": "Recipe Name", "ingredients": ["ingredient 1", "ingredient 2", ...], "instructions": ["step 1", "step 2", ...], "prepTime": "X minutes", "cookTime": "X minutes", "servings": "X"}. Make sure to return valid JSON only.'
      : 'You are a helpful cooking assistant. Provide helpful cooking advice, tips, and answer cooking-related questions in a friendly manner.';

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI API call failed:', error);
      throw error;
    }
  };

  const generateRecipe = async () => {
    if (!ingredients.trim()) {
      alert('Please enter some ingredients first!');
      return;
    }
    
    setLoading(true);
    
    try {
      const prompt = `Create a recipe using these ingredients: ${ingredients}. 
      ${dietary ? `Dietary preference: ${dietary}. ` : ''}
      ${cuisine ? `Cuisine style: ${cuisine}. ` : ''}
      Please provide a complete recipe with ingredients list and step-by-step instructions in JSON format.`;
      
      const response = await callOpenAI(prompt, true);
      
      try {
        // Try to parse as JSON
        const recipe = JSON.parse(response);
        setCurrentRecipe(recipe);
      } catch (parseError) {
        console.error('Failed to parse recipe JSON:', parseError);
        console.log('Raw response:', response);
        
        // Fallback: create a basic recipe structure
        setCurrentRecipe({
          title: 'Generated Recipe',
          ingredients: [`Using: ${ingredients}`],
          instructions: ['Unable to parse recipe. Please try again.'],
          prepTime: 'N/A',
          cookTime: 'N/A',
          servings: 'N/A'
        });
      }
    } catch (error) {
      console.error('Error generating recipe:', error);
      alert(`Error generating recipe: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage = { type: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    
    const question = chatInput;
    setChatInput('');
    
    try {
      const prompt = `Answer this cooking question: ${question}. 
      ${currentRecipe ? `Context: The user is working with a recipe for ${currentRecipe.title}.` : ''}
      Provide helpful, practical cooking advice.`;
      
      const response = await callOpenAI(prompt, false);
      
      const aiMessage = { type: 'ai', content: response };
      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error in chat:', error);
      const errorMessage = { 
        type: 'ai', 
        content: `Sorry, I encountered an error: ${error.message}` 
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  // Check if API key is properly configured
  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-5 flex items-center justify-center">
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
              🍳 Smart Recipe Assistant
            </h1>
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg">
              <p className="font-semibold mb-2">Configuration Required</p>
              <p className="text-sm">Please add your OpenAI API key to the .env file:</p>
              <code className="block mt-2 bg-gray-100 p-2 rounded text-xs">
                REACT_APP_OPENAI_API_KEY=your_api_key_here
              </code>
              <p className="text-xs mt-2">Then restart your development server.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-5">
      <div className="max-w-4xl mx-auto bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-3">
            🍳 Smart Recipe Assistant
          </h1>
          <p className="text-gray-600 text-lg">
            Turn your ingredients into delicious meals with AI-powered recipe suggestions
          </p>
        </div>

        {/* Input Section */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Available Ingredients
              </label>
              <textarea
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder="e.g., chicken breast, rice, onions, garlic, tomatoes..."
                rows="4"
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all resize-none"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Dietary Preferences
              </label>
              <select
                value={dietary}
                onChange={(e) => setDietary(e.target.value)}
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all"
              >
                <option value="">No specific preference</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="gluten-free">Gluten-Free</option>
                <option value="keto">Keto</option>
                <option value="low-carb">Low-Carb</option>
                <option value="dairy-free">Dairy-Free</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Cuisine Style
              </label>
              <select
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all"
              >
                <option value="">Any cuisine</option>
                <option value="italian">Italian</option>
                <option value="asian">Asian</option>
                <option value="mexican">Mexican</option>
                <option value="mediterranean">Mediterranean</option>
                <option value="american">American</option>
                <option value="indian">Indian</option>
                <option value="french">French</option>
                <option value="thai">Thai</option>
              </select>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={generateRecipe}
          disabled={loading || !ingredients.trim()}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 px-8 rounded-xl text-lg font-semibold hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mb-8"
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
              AI Chef is cooking up something delicious...
            </div>
          ) : (
            '✨ Generate Recipe with AI'
          )}
        </button>

        {/* Recipe Output */}
        {currentRecipe && !loading && (
          <div className="bg-gray-50 rounded-2xl p-6 mb-8 border-l-4 border-purple-500 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {currentRecipe.title}
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center">
                  🥘 Ingredients
                </h3>
                <ul className="space-y-2">
                  {currentRecipe.ingredients?.map((ingredient, index) => (
                    <li key={index} className="bg-white p-3 rounded-lg border-l-3 border-purple-400 shadow-sm">
                      {ingredient}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center">
                  👨‍🍳 Instructions
                </h3>
                <ol className="space-y-2">
                  {currentRecipe.instructions?.map((step, index) => (
                    <li key={index} className="bg-white p-3 rounded-lg border-l-3 border-green-400 shadow-sm">
                      <span className="font-medium text-green-600 mr-2">{index + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-600">
              {currentRecipe.prepTime && currentRecipe.prepTime !== 'N/A' && (
                <div className="bg-white px-4 py-2 rounded-full">
                  <strong>Prep:</strong> {currentRecipe.prepTime}
                </div>
              )}
              {currentRecipe.cookTime && currentRecipe.cookTime !== 'N/A' && (
                <div className="bg-white px-4 py-2 rounded-full">
                  <strong>Cook:</strong> {currentRecipe.cookTime}
                </div>
              )}
              {currentRecipe.servings && currentRecipe.servings !== 'N/A' && (
                <div className="bg-white px-4 py-2 rounded-full">
                  <strong>Serves:</strong> {currentRecipe.servings}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chat Section */}
        <div className="bg-gray-50 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">💬 Ask the AI Chef</h3>
          
          <div
            ref={chatMessagesRef}
            className="bg-white rounded-xl p-4 h-64 overflow-y-auto mb-4 space-y-3"
          >
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Ask me anything about cooking, substitutions, or techniques!
              </div>
            ) : (
              chatMessages.map((message, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg max-w-xs ${
                    message.type === 'user'
                      ? 'bg-purple-500 text-white ml-auto'
                      : 'bg-gray-100 text-gray-800 border-l-3 border-green-400'
                  }`}
                >
                  {message.content}
                </div>
              ))
            )}
          </div>

          <div className="flex gap-3">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about substitutions, cooking tips, or anything else..."
              className="flex-1 p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all"
            />
            <button
              onClick={sendChatMessage}
              disabled={!chatInput.trim()}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipeAssistant;