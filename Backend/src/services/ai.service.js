const { createGoogleGenerativeAI } = require('@ai-sdk/google');
const { generateText, Output } = require('ai') ;
const { z } = require('zod');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY, 
});


const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job describe"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum([ "low", "medium", "high" ]).describe("The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc."),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.")
    })).describe("A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively"),
    title: z.string().describe("The title of the job for which the interview report is generated"),
})

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {


    const prompt = `You are an expert Technical Recruiter. 
    Analyze the following candidate data against the Job Description.
    
    Resume: ${resume}
    Self Description: ${selfDescription}
    Job Description: ${jobDescription}
    
    Provide a detailed interview report including a match score, technical/behavioral questions, skill gaps, and a structured preparation plan.` 
    try{
          const { output } = await generateText({
            model: google('gemini-3-flash-preview'), 
            output: Output.object({
                schema: interviewReportSchema,
            }),
            prompt: prompt,
          });

          console.log(JSON.stringify(output, null, 2));
  
          return output;
    } catch (error) {
      console.error("Error generating report:", error);
    }

}

async function generatePdfFromHtml(htmlContent) {
    let executablePath = null;
    
    if (process.env.NODE_ENV === 'production') {
        try {
            const chromeDir = '/opt/render/project/puppeteer/chrome';
            if (fs.existsSync(chromeDir)) {
                const folders = fs.readdirSync(chromeDir);
                const linuxFolder = folders.find(f => f.startsWith('linux-'));
                if (linuxFolder) {
                    executablePath = path.join(chromeDir, linuxFolder, 'chrome-linux64', 'chrome');
                }
            }
        } catch (err) {
            console.error("Path discovery failed:", err.message);
        }
    }

    const browser = await puppeteer.launch({
        executablePath: executablePath || null,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--single-process",
            "--no-zygote"
        ],
    });

    try {
        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(60000);
        await page.setContent(htmlContent, { waitUntil: "networkidle0" });

        const pdfBuffer = await page.pdf({ 
            format: "A4", 
            printBackground: true,
            margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" }
        });

        return pdfBuffer;
    } catch (error) {
        console.error("PDF Generation failed:", error.message);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}


async function generateResumePdf({ resume, selfDescription, jobDescription}){
    
    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
    })

    const prompt = `Generate resume for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}

                        the response should be a JSON object with a single field "html" which contains the HTML content of the resume which can be converted to PDF using any library like puppeteer.
                        The resume should be tailored for the given job description and should highlight the candidate's strengths and relevant experience. The HTML content should be well-formatted and structured, making it easy to read and visually appealing.
                        The content of resume should be not sound like it's generated by AI and should be as close as possible to a real human-written resume.
                        you can highlight the content using some colors or different font styles but the overall design should be simple and professional.
                        The content should be ATS friendly, i.e. it should be easily parsable by ATS systems without losing important information.
                        The resume should not be so lengthy, it should be strictly betweeen 1-2 pages long when converted to PDF. Focus on quality rather than quantity and make sure to include all the relevant information that can increase the candidate's chances of getting an interview call for the given job description.
                        `
            
    try{
        const { output } = await generateText({ //returns data according to schema in json format
            model: google('gemini-3-flash-preview'),
            output: Output.object({
                schema: resumePdfSchema
            }),
            prompt: prompt
        });

        const pdfBuffer = await generatePdfFromHtml(output.html) // passing the html (key) data from output (object) converted from json format to function above generatePdfFromHtml

        return pdfBuffer; // returning the buffer with which we'll create pdf
        
    }catch(err){
        console.error("Error generating report:", err);
    }

}


module.exports = { generateInterviewReport, generateResumePdf }