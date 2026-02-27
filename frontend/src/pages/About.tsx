import { useTranslation } from 'react-i18next'
import {
  Shield, Database, Brain, BarChart3, Users,
  Zap, Globe, Code, Server, Lock,
} from 'lucide-react'

export default function About() {
  const { t } = useTranslation()

  const steps = [
    { icon: Database, text: t('about.step1'), color: 'text-blue-400' },
    { icon: Brain, text: t('about.step2'), color: 'text-purple-400' },
    { icon: BarChart3, text: t('about.step3'), color: 'text-yellow-400' },
    { icon: Zap, text: t('about.step4'), color: 'text-red-400' },
    { icon: Users, text: t('about.step5'), color: 'text-green-400' },
  ]

  const techStack = [
    { category: 'Backend', items: ['Python 3.11', 'FastAPI', 'SQLAlchemy', 'PostgreSQL / SQLite'] },
    { category: 'ML / AI', items: ['scikit-learn', 'XGBoost', 'SHAP', 'spaCy', 'NLP Pipeline'] },
    { category: 'Frontend', items: ['React', 'TypeScript', 'Tailwind CSS', 'Recharts'] },
    { category: 'DevOps', items: ['Docker', 'docker-compose', 'Vite', 'GitHub Actions'] },
  ]

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Hero */}
      <div className="card bg-gradient-to-br from-kz-blue/10 to-kz-gold/5 border-kz-blue/30">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-kz-blue rounded-2xl flex items-center justify-center">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">{t('about.title')}</h1>
            <p className="text-kz-blue text-lg">{t('app.description')}</p>
          </div>
        </div>
      </div>

      {/* Mission */}
      <div className="card">
        <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
          <Globe className="w-5 h-5 text-kz-blue" />
          {t('about.mission')}
        </h2>
        <p className="text-gray-300 leading-relaxed">{t('about.missionText')}</p>
      </div>

      {/* Problem & Solution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card border-red-500/20">
          <h2 className="text-xl font-bold text-red-400 mb-3 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            {t('about.problem')}
          </h2>
          <p className="text-gray-300 leading-relaxed text-sm">{t('about.problemText')}</p>
        </div>
        <div className="card border-green-500/20">
          <h2 className="text-xl font-bold text-green-400 mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            {t('about.solution')}
          </h2>
          <p className="text-gray-300 leading-relaxed text-sm">{t('about.solutionText')}</p>
        </div>
      </div>

      {/* How it works */}
      <div className="card">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Code className="w-5 h-5 text-kz-blue" />
          {t('about.howItWorks')}
        </h2>
        <div className="space-y-4">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-kz-surface rounded-lg flex items-center justify-center border border-kz-border">
                <step.icon className={`w-5 h-5 ${step.color}`} />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs font-mono text-gray-500 bg-kz-surface px-2 py-0.5 rounded">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="text-gray-300 text-sm">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <div className="card">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Server className="w-5 h-5 text-kz-blue" />
          {t('about.techStack')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {techStack.map((cat) => (
            <div key={cat.category} className="bg-kz-surface rounded-lg p-4 border border-kz-border">
              <h3 className="text-sm font-semibold text-kz-blue mb-2">{cat.category}</h3>
              <div className="flex flex-wrap gap-2">
                {cat.items.map((item) => (
                  <span
                    key={item}
                    className="text-xs px-2 py-1 rounded bg-kz-border/50 text-gray-300"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Impact */}
      <div className="card bg-gradient-to-br from-kz-gold/10 to-transparent border-kz-gold/30">
        <h2 className="text-xl font-bold text-kz-gold mb-3">{t('about.impact')}</h2>
        <p className="text-gray-300 leading-relaxed">{t('about.impactText')}</p>
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-gray-500 text-sm">
        <p>TechnoFilter v1.0 — Kazakhstan AI Hackathon 2024</p>
        <p className="mt-1">Built with 🇰🇿 for fair public procurement</p>
      </div>
    </div>
  )
}
