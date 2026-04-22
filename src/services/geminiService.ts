/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { Question, Quiz, FileData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function parseQuizContent(source: string | FileData, numQuestions: number = 10): Promise<Quiz> {
  let contentPart: any;

  if (typeof source === 'string') {
    contentPart = { text: source };
  } else {
    contentPart = {
      inlineData: {
        data: source.data,
        mimeType: source.mimeType
      }
    };
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { 
          text: `Bạn là một chuyên gia giáo dục. Hãy đọc tài liệu và thực hiện:
          1. Soạn/Trích xuất chính xác đúng ${numQuestions} câu hỏi trắc nghiệm quan trọng nhất.
          2. Xác định đáp án đúng và viết lời giải thích NGẮN GỌN nhưng ĐỦ Ý (Tại sao đúng, lỗi sai chính ở phương án khác).
          3. Trình bày lời giải thích rõ ràng cho người học.
          
          Trả về kết quả JSON theo schema.` 
        },
        contentPart
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                correctAnswer: { type: Type.INTEGER },
                explanation: { type: Type.STRING }
              },
              required: ["text", "options", "correctAnswer"]
            }
          }
        },
        required: ["title", "questions"]
      }
    }
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error("Không nhận được phản hồi từ AI. Có thể tài liệu quá phức tạp hoặc bị chặn.");
  }

  let quizData;
  try {
    quizData = JSON.parse(responseText.trim());
  } catch (e) {
    console.error("JSON parse error:", responseText);
    throw new Error("AI trả về dữ liệu không đúng định dạng JSON. Vui lòng thử lại.");
  }
  
  if (!quizData.questions || !Array.isArray(quizData.questions)) {
    throw new Error("Dữ liệu trắc nghiệm bị thiếu hoặc không hợp lệ.");
  }

  quizData.questions = quizData.questions.map((q: any, index: number) => ({
    ...q,
    id: q.id || `q-${index}`
  }));

  return quizData as Quiz;
}
