import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const RecipeAssistant = ({ session }) => {
  const [ingredients, setIngredients] = useState('');
  const [dietary, setDietary] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentRecipe, setCurrentRecipe] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [showSavedRecipes, setShowSavedRecipes] = useState(false);
  const [savingRecipe, setSavingRecipe] = useState(false);
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

  useEffect(() => {
    // Load saved recipes when component mounts
    fetchSavedRecipes();
  }, []);

  const fetchSavedRecipes = async () => {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedRecipes(data || []);
    } catch (error) {
      console.error('Error fetching saved recipes:', error);
    }
  };

  const saveRecipe = async () => {
    if (!currentRecipe) return;
    
    setSavingRecipe(true);
    try {
      const { error } = await supabase
        .from('recipes')
        .insert([
          {
            user_id: session.user.id,
            title: currentRecipe.title,
            ingredients: currentRecipe.ingredients,
            instructions: currentRecipe.instructions,
            prep_time: currentRecipe.prepTime,
            cook_time: currentRecipe.cookTime,
            servings: currentRecipe.servings,
            dietary_preference: dietary,
            cuisine_style: cuisine
          }
        ]);

      if (error) throw error;
      
      alert('Recipe saved successfully!');
      fetchSavedRecipes(); // Refresh the saved recipes list
    } catch (error) {
      console.error('Error saving recipe:', error);
      alert('Error saving recipe. Please try again.');
    } finally {
      setSavingRecipe(false);
    }
  };

  const deleteRecipe = async (recipeId) => {
    if (!window.confirm('Are you sure you want to delete this recipe?')) return;

    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId)
        .eq('user_id', session.user.id);

      if (error) throw error;
      
      fetchSavedRecipes(); // Refresh the saved recipes list
    } catch (error) {
      console.error('Error deleting recipe:', error);
      alert('Error deleting recipe. Please try again.');
    }
  };

  const loadRecipe = (recipe) => {
    setCurrentRecipe({
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      prepTime: recipe.prep_time,
      cookTime: recipe.cook_time,
      servings: recipe.servings
    });
    setDietary(recipe.dietary_preference || '');
    setCuisine(recipe.cuisine_style || '');
    setShowSavedRecipes(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

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
            <p className="text-sm text-gray-600 mb-4">
              Logged in as: {session.user.email}
            </p>
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg">
              <p className="font-semibold mb-2">Configuration Required</p>
              <p className="text-sm">Please add your OpenAI API key to the .env file:</p>
              <code className="block mt-2 bg-gray-100 p-2 rounded text-xs">
                REACT_APP_OPENAI_API_KEY=your_api_key_here
              </code>
              <p className="text-xs mt-2">Then restart your development server.</p>
            </div>
            <button
              onClick={handleSignOut}
              className="mt-4 text-purple-600 hover:text-purple-700 font-medium"
            >
              Sign Out
            </button>
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
          <div className="mt-4 flex items-center justify-center gap-4">
            <span className="text-sm text-gray-600">
              Welcome, {session.user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Saved Recipes Button */}
        <div className="mb-6 flex justify-center">
          <button
            onClick={() => setShowSavedRecipes(!showSavedRecipes)}
            className="bg-white text-purple-600 border-2 border-purple-600 px-6 py-2 rounded-xl font-semibold hover:bg-purple-50 transition-all duration-300"
          >
            {showSavedRecipes ? 'Hide' : 'Show'} Saved Recipes ({savedRecipes.length})
          </button>
        </div>

        {/* Saved Recipes List */}
        {showSavedRecipes && (
          <div className="mb-8 bg-gray-50 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">📚 Your Saved Recipes</h3>
            {savedRecipes.length === 0 ? (
              <p className="text-gray-600 text-center py-4">No saved recipes yet. Generate and save your first recipe!</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {savedRecipes.map((recipe) => (
                  <div key={recipe.id} className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{recipe.title}</h4>
                      <p className="text-sm text-gray-600">
                        {recipe.dietary_preference && `${recipe.dietary_preference} • `}
                        {recipe.cuisine_style && `${recipe.cuisine_style} • `}
                        Saved {new Date(recipe.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadRecipe(recipe)}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 transition-colors"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => deleteRecipe(recipe.id)}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                {currentRecipe.title}
              </h2>
              <button
                onClick={saveRecipe}
                disabled={savingRecipe}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {savingRecipe ? 'Saving...' : '💾 Save Recipe'}
              </button>
            </div>
            
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