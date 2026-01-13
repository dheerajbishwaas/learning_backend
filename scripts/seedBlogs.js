const axios = require('axios');

const API_URL = 'http://localhost:5000/api/blogs';

const blogs = [
    {
        id: "1",
        slug: "getting-started-with-nextjs-and-react",
        title: "Getting Started with Next.js and React",
        excerpt: "Learn how to build scalable web applications using the power of Next.js and React. A comprehensive guide for beginners.",
        content: `
            <p>Next.js is a React framework that gives you building blocks to create web applications. By framework, we mean Next.js handles the tooling and configuration needed for React, and provides additional structure, features, and optimizations for your application.</p>
            
            <h3>Why Next.js?</h3>
            <p>React is a library for building user interfaces. You can use it to build small parts of your page or the entire page. However, keeping typical modern web application requirements in view (like routing, data fetching, and integrations), you usually need a framework.</p>
            
            <ul>
                <li><strong>Server-Side Rendering (SSR):</strong> Automatically renders the page on the server for better SEO and performance.</li>
                <li><strong>File-based Routing:</strong> No need for complex routing libraries. Just create files in the <code>pages</code> directory.</li>
                <li><strong>API Routes:</strong> Build API endpoints right inside your Next.js app.</li>
            </ul>

            <p>Start your journey today by installing Next.js with <code>npx create-next-app@latest</code>.</p>
        `,
        author: "Dev Team",
        date: "Oct 24, 2025",
        readTime: "5 min read",
        image: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
        tags: ["Next.js", "React", "Web Dev"]
    },
    {
        id: "2",
        slug: "understanding-css-grid-layout",
        title: "Mastering CSS Grid Layout",
        excerpt: "CSS Grid Layout excels at dividing a page into major regions or defining the relationship in terms of size, position, and layer.",
        content: `
            <p>CSS Grid Layout is a two-dimensional layout system for the web. It lets you lay out items in rows and columns. It has many features that make building complex layouts straightforward.</p>
            
            <h3>Grid vs. Flexbox</h3>
            <p>Flexbox is designed for one-dimensional layouts (a row OR a column). CSS Grid is designed for two-dimensional layouts (rows AND columns at the same time).</p>
            
            <p>To get started, simply define a container as a grid:</p>
            <pre><code>.container { display: grid; }</code></pre>
            
            <p>You can then define your columns and rows using properties like <code>grid-template-columns</code> and <code>grid-template-rows</code>.</p>
        `,
        author: "Design Lead",
        date: "Nov 02, 2025",
        readTime: "7 min read",
        image: "https://images.unsplash.com/photo-1507721999472-8ed4421c4af2?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
        tags: ["CSS", "Design", "Frontend"]
    },
    {
        id: "3",
        slug: "nodejs-best-practices-2026",
        title: "Node.js Best Practices for 2026",
        excerpt: "Keep your Node.js applications secure, performant, and maintainable with these industry-accepted best practices.",
        content: `
            <p>Node.js continues to evolve. As we move into 2026, keeping up with best practices is crucial for enterprise-grade applications.</p>
            
            <h3>1. Use Async/Await</h3>
            <p>Forget callbacks. Even Promises are becoming verbose. Async/Await makes your asynchronous code look and behave like synchronous code, making it easier to read and debug.</p>
            
            <h3>2. Proper Error Handling</h3>
            <p>Don't just console.log errors. Use a centralized error handling mechanism. Ensure you catch unhandled promise rejections properly.</p>
            
            <h3>3. Security First</h3>
            <p>Always sanitize user inputs. Use libraries like Helmet to secure your HTTP headers. Keep your dependencies updated to avoid vulnerabilities.</p>
        `,
        author: "Backend Pro",
        date: "Dec 15, 2025",
        readTime: "6 min read",
        image: "https://images.unsplash.com/photo-1627398242450-2701705a63d1?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
        tags: ["Node.js", "Backend", "Security"]
    },
    {
        id: "4",
        slug: "future-of-ai-in-coding",
        title: "The Future of AI in Software Development",
        excerpt: "How AI agents and LLMs are transforming the way we write, debug, and deploy code.",
        content: `
            <p>Artificial Intelligence is no longer just a buzzword in the tech industry; it's a daily tool for millions of developers. From GitHub Copilot to advanced agents like Devin and Google's Gemini, the landscape is shifting.</p>
            
            <p>AI isn't replacing developers; it's augmenting them. It handles the boilerplate, the tedious refactoring, and the test writing, allowing humans to focus on <strong>architecture</strong> and <strong>problem-solving</strong>.</p>
        `,
        author: "Tech Trends",
        date: "Jan 10, 2026",
        readTime: "4 min read",
        image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
        tags: ["AI", "Future", "Programming"]
    }
];

const seedBlogs = async () => {
    console.log('Seeding blogs...');
    for (const blog of blogs) {
        try {
            await axios.post(API_URL, blog);
            console.log(`Created: ${blog.title}`);
        } catch (error) {
            if (error.response && error.response.status === 400 && error.response.data.message.includes('already exists')) {
                console.log(`Already exists: ${blog.title}`);
            } else {
                console.error(`Failed to create ${blog.title}:`, error.toJSON ? error.toJSON() : error);
            }
        }
    }
    console.log('Seeding complete.');
};

const verifyEndpoints = async () => {
    try {
        console.log('\nVerifying Get All...');
        const resAll = await axios.get(API_URL);
        console.log(`Fetch success. Count: ${resAll.data.count}`);

        if (resAll.data.count > 0) {
            const firstBlogSlug = resAll.data.data[0].slug;
            console.log(`\nVerifying Get By Slug (${firstBlogSlug})...`);
            const resSlug = await axios.get(`${API_URL}/${firstBlogSlug}`);
            console.log(`Fetch success. Title: ${resSlug.data.data.title}`);
        }
    } catch (error) {
        console.error('Verification failed:', error.toJSON ? error.toJSON() : error);
    }
};

(async () => {
    await seedBlogs();
    await verifyEndpoints();
})();
