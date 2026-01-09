import {GoogleGenerativeAI} from "@google/generative-ai";

const apiKey=import.meta.env.VITE_GEMINI_API_KEY;
const genAI=new GoogleGenerativeAI(apiKey);

export async function tryThis(){
    try{
        const model=genAI.getGenerativeModel({model:"gemini-2.0-flash"});
        const prompt="tell me a random joke!";
        const result=await model.generateContent(prompt);
        const response= await result.response;
        return response.text();
    }
    catch (error){
        console.error("Error",error);
        return "OOPS!";
    }
}