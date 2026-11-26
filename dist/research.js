window.RESEARCH = {
  "title": "StateWeaver: Multi-Agent Coordination of Story-State Transitions for Long-Horizon Video Generation",
  "authors": [
    {
      "name": "Modi Jin",
      "url": "https://ghost233lism.github.io/",
      "aff": [
        1
      ]
    },
    {
      "name": "Xuying Zhang",
      "url": "https://zhangxuying1004.github.io/",
      "aff": [
        2,
        1
      ]
    },
    {
      "name": "Yijing Guo",
      "url": "https://scholar.google.com/citations?user=EuOmru0AAAAJ",
      "aff": [
        3
      ]
    },
    {
      "name": "Haoran Li",
      "url": "https://jahnsonblack.github.io/",
      "aff": [
        2
      ]
    },
    {
      "name": "Yanwen Ma",
      "url": "https://gelercat.com/",
      "aff": [
        4
      ]
    },
    {
      "name": "Jing Wang",
      "url": "https://openreview.net/profile?id=~Jing_Wang145",
      "aff": [
        1
      ]
    },
    {
      "name": "Chenyu Ge",
      "url": "https://openreview.net/profile?id=~Chenyu_Ge1",
      "aff": [
        1
      ]
    },
    {
      "name": "Ming-Ming Cheng",
      "url": "https://mmcheng.net/cmm/",
      "aff": [
        1
      ]
    },
    {
      "name": "Haoyang Huang",
      "url": "https://hhyhhyhy.github.io/",
      "aff": [
        2
      ]
    }
  ],
  "affiliations": [
    "Nankai University",
    "Joy Future Academy, JD",
    "ShanghaiTech University",
    "Beihang University"
  ],
  "paperUrl": "https://arxiv.org/abs/2611.34290",
  "bibtex": "@misc{jin2026stateweavermultiagentcoordinationstorystate,\n      title={StateWeaver: Multi-Agent Coordination of Story-State Transitions for Long-Horizon Video Generation},\n      author={Modi Jin and Xuying Zhang and Yijing Guo and Haoran Li and Yanwen Ma and Jing Wang and Chenyu Ge and Ming-Ming Cheng and Haoyang Huang},\n      year={2026},\n      eprint={2611.34290},\n      archivePrefix={arXiv},\n      primaryClass={cs.CV},\n      url={https://arxiv.org/abs/2611.34290},\n}",
  "abstract": [
    "Modern video foundation models generate high-quality short clips, but preserving long-video consistency and correctly depicting event-driven state changes remain challenging. Existing agentic workflows face these challenges because continual planning and repair accumulate context, while reference updates remain limited. We introduce StateWeaver, which combines Active States and Hierarchical Collaboration to connect review-driven visual reference updates with cross-shot state inheritance. Active States translate state discrepancies identified during review into concrete visual asset requirements that guide reference construction, validation, and regeneration, preserving identity and already-correct content while repairing target attributes. Confirmed generation results are linked to the corresponding asset states, story time, and reference versions for verification and reuse by subsequent shots. Hierarchical Collaboration isolates execution contexts by task, clip, and repair round, and uses hierarchical memory to organize this process across multiple sets. Across multiple benchmarks, StateWeaver outperforms existing methods and produces long videos with sustained cross-shot consistency under predefined and autonomously planned storyboards.",
    "现代视频基础模型已能生成高质量短片段，但长视频仍难以保持一致性并准确呈现事件引起的状态变化。现有智能体工作流面临这些挑战，是因为持续规划与修复会累积上下文，而参考更新能力仍有限。为此，我们提出 StateWeaver，通过主动状态与层级化协作，将审核驱动的视觉参考更新与跨镜头状态继承连接起来。主动状态将审核发现的状态偏差转化为具体的视觉资产需求，指导参考构建、验证与重新生成，在修复目标属性时保留身份与已正确内容。经确认的生成结果关联对应资产状态、故事时间与参考版本，供后续镜头核验和复用。层级化协作按任务、片段与修复轮次隔离执行上下文，并通过分层记忆组织上述过程在多个片场中的持续运行。实验结果表明，StateWeaver 在多个基准上优于现有方法，并能在固定分镜与自主分镜模式下生成持续保持跨镜头一致性的长视频。"
  ],
  "methodFigure": "media/research/method.webp",
  "method": [
    {
      "title": [
        "Active States",
        "主动状态"
      ],
      "text": [
        "When a shot changes an object or character, the team records the new state and when it takes effect. A failed review can trigger a targeted reference update and a new take. Later shots inherit the verified result.",
        "当一个镜头改变道具或人物的状态，团队会记录变化及其生效的故事时间。审核发现偏差后，会针对具体属性更新参考并重新生成，后续镜头可继承核验后的结果。"
      ]
    },
    {
      "title": [
        "Hierarchical Collaboration",
        "层级化协作"
      ],
      "text": [
        "The chief director assigns connected story units to sets. Set directors plan, generate and review clips. Executive directors handle delegated work, including asset preparation and repair diagnosis. The teams share verified facts through hierarchical memory.",
        "总导演把相互关联的剧情单元分配到各个片场。片场导演规划、生成和审核片段，执行导演负责受委派的素材准备、修复诊断等任务。各个团队通过分层记忆共享已经核验的事实。"
      ]
    }
  ],
  "resources": {
    "paper": "https://arxiv.org/abs/2611.34290",
    "chinese": null,
    "code": null,
    "demo": "#bench",
    "poster": null
  }
};
