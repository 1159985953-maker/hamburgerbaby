// src/services/memoryService.ts
// ==================== [防崩溃版] 智能图书管理员 V3.0 ====================
// 这是一组什么代码：这是核心搜索服务。它增加了“安全网”，如果 AI 模型因网络问题加载失败，它会自动切换到“关键词匹配模式”，保证程序不报错。

import { pipeline, Pipeline } from '@xenova/transformers';

// 1. 定义文档格式
export interface Document {
    id: string;        // 唯一ID
    content: string;   // 内容
    type: string;      // 类型 (如: '聊天记录', '核心记忆')
    timestamp: number; // 时间
}

// 2. 嵌入模型单例 (魔法工具箱)
class EmbeddingPipeline {
    static instance: Pipeline | null = null;
    static task = 'feature-extraction';
    static model = 'Xenova/bge-small-zh-v1.5';

    static async getInstance(progress_callback?: Function) {
        if (this.instance === null) {
            // ⚠️ 注意：这里最容易因为网络问题报错
            this.instance = await pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
    }
}

// 3. 向量化函数 (把字变成数字)
export const embed = async (text: string): Promise<number[]> => {
    const extractor = await EmbeddingPipeline.getInstance();
    const result = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
};

// 4. 余弦相似度计算
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

// 5. ★★★ 核心修复：带兜底机制的搜索函数 ★★★
export const searchDocuments = async (
    query: string,
    documents: Document[],
    topK: number = 5
): Promise<Document[]> => {
    if (!query || !documents || documents.length === 0) {
        return [];
    }

    console.log(`[📚 图书馆] 正在搜索... (档案数: ${documents.length})`);

    try {
        // --- 尝试 A 计划：高级 AI 向量搜索 ---
        // 1. 把问题向量化
        const queryVector = await embed(query);

        // 2. 把文档向量化 (并行处理)
        const docVectors = await Promise.all(
            documents.map(doc => embed(doc.content))
        );

        // 3. 算分
        const similarities = docVectors.map((docVec, i) => ({
            index: i,
            score: calculateSimilarity(queryVector, docVec)
        }));

        // 4. 排序
        similarities.sort((a, b) => b.score - a.score);

        // 5. 返回前 K 个
        const results = similarities.slice(0, topK).map(item => documents[item.index]);
        console.log(`[📚 图书馆] AI 检索成功！找到 ${results.length} 条相关记录。`);
        return results;

    } catch (error) {
        // --- 触发 B 计划：关键词匹配兜底 ---
        console.warn("============================================================");
        console.warn("⚠️ [图书馆警报] AI 模型加载失败 (通常是网络原因)。");
        console.warn("⚠️ 错误详情:", error);
        console.warn("🔄 已自动切换为【关键词匹配模式】，确保 App 不崩溃。");
        console.warn("============================================================");

        // 简单的关键词匹配逻辑
        const keywords = query.split(/[\s,，。？！]+/).filter(k => k.length > 1); // 提取查询中的词
        
        const scoredDocs = documents.map(doc => {
            let score = 0;
            // 如果文档包含查询中的词，就加分
            keywords.forEach(keyword => {
                if (doc.content.includes(keyword)) score += 1;
            });
            // 最近发生的加一点分 (时间权重)
            const timeWeight = (doc.timestamp / Date.now()) * 0.5; 
            return { doc, score: score + timeWeight };
        });

        // 过滤掉 0 分的，按分数排序
        const fallbackResults = scoredDocs
            .filter(item => item.score > 0.5) // 至少要有点相关性
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map(item => item.doc);

        console.log(`[📚 兜底搜索] 找到 ${fallbackResults.length} 条含有关键词的记录。`);
        return fallbackResults;
    }
};