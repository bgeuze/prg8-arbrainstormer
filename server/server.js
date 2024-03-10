import express from 'express';
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RetrievalQAChain } from "langchain/chains";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { CohereEmbeddings } from "@langchain/cohere";
import { MongoClient } from "mongodb";
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const loader = new TextLoader("./tekst.txt");
const data = await loader.load();

const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1500, chunkOverlap: 100 });
const splitDocs = await textSplitter.splitDocuments(data);

const model = new ChatOpenAI({
    azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
    azureOpenAIApiVersion: process.env.OPENAI_API_VERSION,
    azureOpenAIApiInstanceName: process.env.INSTANCE_NAME,
    azureOpenAIApiDeploymentName: process.env.ENGINE_NAME,
});

const embeddings = new OpenAIEmbeddings({
    azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
    azureOpenAIApiVersion: process.env.OPENAI_API_VERSION,
    azureOpenAIApiInstanceName: process.env.INSTANCE_NAME,
    azureOpenAIApiDeploymentName: process.env.DEPLOYMENT_NAME,
});

app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

const client = new MongoClient(process.env.MONGODB_ATLAS_URI || "");

client.connect()
    .then(() => {
        console.log("Connected to MongoDB Atlas successfully! EMBED");

        app.get('/embed', async (req, res) => {
            try {
                const loader = new TextLoader("./tekst.txt");
                const data = await loader.load();

                const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1500, chunkOverlap: 100 });
                const splitDocs = await textSplitter.splitDocuments(data);

                // Connect to MongoDB Atlas
                const namespace = "prg8.prg8";
                const [dbName, collectionName] = namespace.split(".");
                const collection = client.db(dbName).collection(collectionName);

                const combinedText = splitDocs.map(doc => doc.pageContent).join(' ');
                const vectordata = await embeddings.embedQuery(combinedText);

                // Save embeddings to MongoDB Atlas
                const result = await collection.insertOne({ embeddings: [vectordata] });
                console.log("Embeddings saved to MongoDB Atlas:", result.insertedId);
                res.json({ success: true, message: "Embeddings saved to MongoDB Atlas" });
            } catch (error) {
                console.error('Error processing request:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

    })
    .catch(err => {
        console.error("Error connecting to MongoDB Atlas:", err);
    });

app.post('/chat', async (req, res) => {
    const query = req.body.query;

    try {
        if (!query) {
            throw new Error('Query is missing');
        }

        // Als de gebruiker vraagt naar het laatste nieuws over AR
        if (query.toLowerCase().includes('laatste nieuws over ar')) {
            // Haal het laatste nieuws over AR op van de NewsAPI
            const apiKey = '622295c40c4c4cbc8971776aac1f5899'; // Je API-sleutel voor de NewsAPI
            const apiUrl = `https://newsapi.org/v2/everything?q=augmented-reality&apiKey=${apiKey}`;

            // https://newsapi.org/v2/everything?q=augmented-reality&apiKey=${apiKey}

            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data.status !== 'ok' || !data.articles || data.articles.length === 0) {
                throw new Error('Failed to fetch news data');
            }

            // Haal de titel van het eerste nieuwsartikel op en stuur het terug als reactie
            const firstArticleTitle = data.articles[0].title;
            const responseMessage = `Het laatste nieuws over AR is: ${firstArticleTitle}`;

            res.json({ response: responseMessage });
        } else {
            const client = new MongoClient(process.env.MONGODB_ATLAS_URI || "");
            await client.connect();
            console.log("Connected to MongoDB Atlas successfully! CHAT");

            const namespace = "prg8.prg8";
            const [dbName, collectionName] = namespace.split(".");
            const collection = client.db(dbName).collection(collectionName);

            try {
                const result = await collection.findOne({});

                const vectorsFromAtlas = result.embeddings

                // console.log(vectorsFromAtlas)

                console.log(splitDocs)

                const vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);
                const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever());

                const response = await chain.call({ query: query });
                res.json({ response: response.text });
            } catch (error) {
                console.error("Error querying MongoDB:", error);
                res.status(500).json({ error: error.message });
            }
        }
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/news', async (req, res) => {
    try {
        const apiKey = '622295c40c4c4cbc8971776aac1f5899';
        const apiUrl = `https://newsapi.org/v2/top-headlines?apiKey=${apiKey}&country=us`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.status !== 'ok') {
            throw new Error('Failed to fetch news data');
        }

        const articles = data.articles.map(article => ({
            title: article.title,
            description: article.description,
            url: article.url
        }));

        res.json({ articles });
    } catch (error) {
        console.error('Error fetching news data:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
