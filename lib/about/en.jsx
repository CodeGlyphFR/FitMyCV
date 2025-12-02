export default function AboutContentEN() {
  return (
    <div className="prose dark:prose-invert max-w-none space-y-4">
      {/* Introduction */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          Our story
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          FitMyCV was born from a frustration many know too well: spending hours adapting your resume for each job application. Rephrasing, reorganizing, hoping this time it will pass the recruiter filters...
        </p>
        <p className="text-sm text-white/90 drop-shadow">
          We thought there had to be a better way. What if AI could help us create resumes truly tailored to each job offer?
        </p>
      </section>

      {/* Mission */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          Our mission
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          To save you time and give you the best chances of landing that interview. No generic resume sent en masse, but a tailored CV for each opportunity.
        </p>
        <p className="text-sm text-white/90 drop-shadow">
          Because every job offer is unique, your resume should be too.
        </p>
      </section>

      {/* Features */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          What FitMyCV can do for you
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#10024;</span>
              <h3 className="font-semibold text-white drop-shadow">Smart generation</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              AI analyzes the job offer and adapts your resume to highlight the skills being sought.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#127919;</span>
              <h3 className="font-semibold text-white drop-shadow">Match score</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              Instantly know if your profile matches the job with a detailed compatibility score.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#127758;</span>
              <h3 className="font-semibold text-white drop-shadow">Multi-language</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              Translate your resume in one click. French, English, Spanish, German... your choice.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#9889;</span>
              <h3 className="font-semibold text-white drop-shadow">ATS optimized</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              Pass through automated recruiter filters with properly formatted content.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg md:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#128202;</span>
              <h3 className="font-semibold text-white drop-shadow">Multiple analysis levels</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              From quick to in-depth, choose the analysis level that suits your needs.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          How does it work?
        </h2>
        <div className="space-y-3">
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-500/30 rounded-full flex items-center justify-center text-emerald-300 font-bold text-sm">
              1
            </div>
            <div>
              <h3 className="font-semibold text-white drop-shadow">Import your resume</h3>
              <p className="text-xs text-white/80 drop-shadow">
                Upload your existing resume as PDF or create a new one directly on the platform.
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-500/30 rounded-full flex items-center justify-center text-emerald-300 font-bold text-sm">
              2
            </div>
            <div>
              <h3 className="font-semibold text-white drop-shadow">Paste the job offer</h3>
              <p className="text-xs text-white/80 drop-shadow">
                Copy-paste the text of the job that interests you. AI will analyze it in detail.
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-500/30 rounded-full flex items-center justify-center text-emerald-300 font-bold text-sm">
              3
            </div>
            <div>
              <h3 className="font-semibold text-white drop-shadow">Generate your optimized resume</h3>
              <p className="text-xs text-white/80 drop-shadow">
                In seconds, get a resume tailored to the job, ready to download and send.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          Any questions?
        </h2>
        <p className="text-sm text-white/90 mb-3 drop-shadow">
          Our team is here to help. Don&apos;t hesitate to reach out!
        </p>
        <a
          href="mailto:contact@fitmycv.io"
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          <span>&#9993;</span>
          contact@fitmycv.io
        </a>
        <div className="mt-4 pt-3 border-t border-white/20">
          <p className="text-xs text-white/60 drop-shadow">
            Also check our{' '}
            <a href="/terms" className="text-emerald-300 hover:text-emerald-200 underline transition-colors">
              terms of service
            </a>
            {' '}and{' '}
            <a href="/privacy" className="text-emerald-300 hover:text-emerald-200 underline transition-colors">
              privacy policy
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
