// src/services/memoryService.ts (新建文件)

import { pipeline, Pipeline } from '@xenova/transformers';
import { Contact } from '../types'; // 确保你的 types 文件路径正确

// ==================== 1. 魔法工具箱（嵌入模型）的单例模式 ====================
// 这是一个“单例模式”，保证我们的魔法工具箱（模型）在整个应用中只被加载一次。
// 如果不这么做，每次搜索都会重新加载一次模型，会卡到天荒地老。
class EmbeddingPipeline {
    static instance: Pipeline | null = null;
    static task = 'feature-extraction';
    static model = 'Xenova/bge-small-zh-v1.5'; // 一个小巧但强大的中文模型

    static async getInstance(progress_callback?: Function) {
        if (this.instance === null) {
            this.instance = await pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
    }
}

// ==================== 2. 核心函数：把文字变成“魔法数字”（向量） ====================
export const embed = async (text: string): Promise<number[]> => {
    const extractor = await EmbeddingPipeline.getInstance();
    const result = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
};

// ==================== 3. 核心函数：计算两段文字的“相似度” ====================
// 这是“余弦相似度”的计算，你不需要理解数学，只需要知道它返回一个 -1 到 1 的数字。
// 数字越接近 1，说明两段话意思越像。
const calculateSimilarity = (vecA: number[], vecB: number[]): number => {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// ==================== 4. 终极功能：智能搜索“图书馆” ====================
/**
 * 从一堆记忆便签里，找出和当前问题最相关的几条。
 * @param query - 你的最新一句话
 * @param memories - 角色所有的长期记忆（整个图书馆）
 * @param topK - 你想找出最相关的几条？（比如 3 条）
 * @returns 返回最相关的记忆内容数组
 */
// src/services/memoryService.ts

// ==================== ★★★ 升级版 V2.0：全能图书管理员 ★★★ ====================

// 1. 定义一个通用的“文档”格式，就像给所有书贴上统一的借书卡
export interface Document {
    id: string;        // 唯一ID
    content: string;     // 书的内容
    type: string;        // 书的类型 (如: '聊天记录', '信件')
    timestamp: number;   // 发生时间
}

// 2. 核心功能：智能搜索“整个图书馆”
/**
 * 从所有类型的文档中，找出和当前问题最相关的几条。
 * @param query - 你的最新一句话
 * @param documents - 包含所有记忆的文档数组 (整个图书馆)
 * @param topK - 你想找出最相关的几条？
 * @returns 返回最相关的文档对象数组
 */
export const searchDocuments = async (
    query: string,
    documents: Document[],
    topK: number = 5 // 默认多找几条，信息更全
): Promise<Document[]> => {
    if (!query || !documents || documents.length === 0) {
        return [];
    }

    console.log(`[📚 图书馆 V2.0] 开始为查询: "${query.slice(0, 20)}..." 搜索 ${documents.length} 份档案...`);

    try {
        // 1. 把你的问题向量化
        const queryVector = await embed(query);

        // 2. 把所有文档都向量化
        const docVectors = await Promise.all(
            documents.map(doc => embed(doc.content))
        );

        // 3. 计算相似度分数
        const similarities = docVectors.map((docVec, i) => ({
            index: i,
            score: calculateSimilarity(queryVector, docVec)
        }));

        // 4. 按分数排序
        similarities.sort((a, b) => b.score - a.score);

        // 5. 挑出分数最高的 topK 份“原始档案”
        const topResults = similarities.slice(0, topK).map(item => documents[item.index]);

        console.log(`[📚 图书馆 V2.0] 找到最相关的 ${topResults.length} 份档案！`);
        return topResults;

    } catch (error) {
        console.error("[📚 图书馆 V2.0] 检索失败:", error);
        return []; 
    }
};

// (你原来的 embed 和 calculateSimilarity 函数保持不变，不用动)