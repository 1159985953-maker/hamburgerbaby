// ==================== [最终确认版] src/services/memoryService.ts ====================
// 这是一组什么代码：这是最稳定版本的代码，它把网络修复指令放在了最前面，确保第一时间生效。

import { pipeline, Pipeline, env } from '@xenova/transformers';

// 关键修复：强制所有模型下载请求都通过国内镜像，绕过网络问题。
// 这一行代码必须在所有其他逻辑之前执行！
env.remoteHost = 'https://hf-mirror.com';
env.allowLocalModels = false; // 确保它总是尝试从远程（我们的镜像）加载

// ====================================================================================

// 1. 定义文档格式
export interface Document {
    id: string;
    content: string;
    type: string;
    timestamp: number;
}

// 2. 嵌入模型单例 (魔法工具箱)
class EmbeddingPipeline {
    static instance: Pipeline | null = null;
    static task = 'feature-extraction';
    static model = 'Xenova/bge-small-zh-v1.5';

    static async getInstance(progress_callback?: Function) {
        if (this.instance === null) {
            console.log(`[图书馆] 正在从镜像源 ${env.remoteHost} 尝试下载 AI 模型...`);
            // 这里会使用上面我们设置好的国内镜像地址
            this.instance = await pipeline(this.task, this.model, { progress_callback });
            console.log("[图书馆] AI 模型下载并加载成功！");
        }
        return this.instance;
    }
}

// (后面的 embed, calculateSimilarity, searchDocuments 函数都和你之前的一样，保持不变)

export const embed = async (text: string): Promise<number[]> => {
    const extractor = await EmbeddingPipeline.getInstance();
    const result = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
};

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
        const queryVector = await embed(query);
        const docVectors = await Promise.all(documents.map(doc => embed(doc.content)));
        const similarities = docVectors.map((docVec, i) => ({
            index: i,
            score: calculateSimilarity(queryVector, docVec)
        }));
        similarities.sort((a, b) => b.score - a.score);
        const results = similarities.slice(0, topK).map(item => documents[item.index]);
        console.log(`[📚 图书馆] AI 智能检索成功！找到 ${results.length} 条相关记录。`);
        return results;

    } catch (error) {
        console.warn("============================================================");
        console.warn("⚠️ [图书馆警报] AI 模型加载失败！即使有镜像也失败了！");
        console.warn("⚠️ 错误详情:", error);
        console.warn("🔄 已自动切换为【关键词匹配模式】，确保 App 不崩溃。");
        console.warn("============================================================");

        const keywords = query.split(/[\s,，。？！]+/).filter(k => k.length > 1);
        const scoredDocs = documents.map(doc => {
            let score = 0;
            keywords.forEach(keyword => {
                if (doc.content.includes(keyword)) score += 1;
            });
            const timeWeight = (doc.timestamp / Date.now()) * 0.5;
            return { doc, score: score + timeWeight };
        });

        const fallbackResults = scoredDocs
            .filter(item => item.score > 0.5)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map(item => item.doc);

        console.log(`[兜底搜索] 找到 ${fallbackResults.length} 条含有关键词的记录。`);
        return fallbackResults;
    }
};