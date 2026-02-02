const APP_STORE_URL = 'https://apps.apple.com/app/habits-coach/id000000000';

function AppStoreButton({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const isDark = variant === 'dark';
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        group relative inline-flex items-center gap-3 px-7 py-4 rounded-2xl
        transition-all duration-300 ease-out
        ${isDark
          ? 'bg-[#1a1a1a] text-white hover:bg-[#2a2a2a] hover:scale-[1.02] hover:shadow-xl'
          : 'bg-white text-[#1a1a1a] hover:bg-[#FFFBF5] hover:scale-[1.02] hover:shadow-xl border-2 border-[#1a1a1a]/10'
        }
      `}
    >
      <svg className="w-8 h-8 transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
      <div className="text-left">
        <div className="text-xs font-medium opacity-70">Download on the</div>
        <div className="text-lg font-semibold -mt-0.5">App Store</div>
      </div>
    </a>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  index,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  index: number;
}) {
  return (
    <div
      className={`
        group relative p-8 rounded-3xl
        bg-white/60 backdrop-blur-sm
        border border-[#F5A623]/10
        hover:bg-white hover:border-[#F5A623]/30
        hover:shadow-[0_20px_60px_-15px_rgba(245,166,35,0.2)]
        transition-all duration-500 ease-out
        opacity-0 animate-fade-up
      `}
      style={{ animationDelay: `${index * 150}ms`, animationFillMode: 'forwards' }}
    >
      {/* Decorative corner */}
      <div className="absolute top-0 right-0 w-20 h-20 overflow-hidden rounded-tr-3xl">
        <div className="absolute -top-10 -right-10 w-20 h-20 bg-gradient-to-br from-[#F5A623]/10 to-transparent rounded-full transform group-hover:scale-150 transition-transform duration-500" />
      </div>

      <div className="relative">
        <div className="w-14 h-14 mb-6 rounded-2xl bg-gradient-to-br from-[#F5A623] to-[#E09000] flex items-center justify-center text-white shadow-lg shadow-[#F5A623]/20 group-hover:shadow-[#F5A623]/40 transition-shadow duration-300">
          {icon}
        </div>
        <h3 className="text-xl font-display font-semibold text-[#1a1a1a] mb-3">{title}</h3>
        <p className="text-[#4a4a4a] leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="relative animate-float">
      {/* Glow effect */}
      <div className="absolute inset-0 blur-3xl bg-gradient-to-b from-[#F5A623]/30 to-[#F5A623]/10 rounded-[4rem] transform scale-90" />

      {/* Phone frame */}
      <div className="relative w-[280px] h-[580px] bg-[#1a1a1a] rounded-[3.5rem] p-3 shadow-2xl shadow-[#1a1a1a]/30">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-[#1a1a1a] rounded-b-2xl z-10" />

        {/* Screen */}
        <div className="relative w-full h-full bg-gradient-to-b from-[#FFFBF5] to-[#FFF5E6] rounded-[2.75rem] overflow-hidden">
          {/* Status bar */}
          <div className="flex justify-between items-center px-8 pt-4 text-xs font-medium text-[#1a1a1a]/60">
            <span>9:41</span>
            <div className="flex gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z"/>
              </svg>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/>
              </svg>
            </div>
          </div>

          {/* Chat interface preview */}
          <div className="px-5 pt-6 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-[#F5A623]/10">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F5A623] to-[#E09000] flex items-center justify-center shadow-lg shadow-[#F5A623]/30">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <div className="font-display font-semibold text-[#1a1a1a]">Habits Coach</div>
                <div className="text-xs text-[#7a7a7a]">Your personal AI coach</div>
              </div>
            </div>

            {/* Messages */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F5A623] to-[#E09000] flex-shrink-0" />
                <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm max-w-[85%]">
                  <p className="text-sm text-[#1a1a1a]">Good morning! Ready to check in on your habits today?</p>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="bg-gradient-to-br from-[#F5A623] to-[#E09000] rounded-2xl rounded-tr-md px-4 py-3 max-w-[85%]">
                  <p className="text-sm text-white">Yes! I completed my morning routine</p>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F5A623] to-[#E09000] flex-shrink-0" />
                <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm max-w-[85%]">
                  <p className="text-sm text-[#1a1a1a]">Amazing! That&apos;s 7 days in a row! 🔥</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="grain min-h-screen overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Large gradient blob */}
          <div className="absolute -top-1/4 -right-1/4 w-[800px] h-[800px] blob bg-gradient-to-br from-[#F5A623]/20 via-[#FFD180]/10 to-transparent animate-pulse-soft" />
          <div className="absolute top-1/2 -left-1/4 w-[600px] h-[600px] blob-2 bg-gradient-to-tr from-[#F5A623]/10 to-transparent animate-float-delayed" />

          {/* Decorative circles */}
          <div className="absolute top-20 left-[10%] w-3 h-3 rounded-full bg-[#F5A623]/40 animate-float" />
          <div className="absolute top-40 right-[15%] w-2 h-2 rounded-full bg-[#F5A623]/30 animate-float-delayed" />
          <div className="absolute bottom-40 left-[20%] w-4 h-4 rounded-full bg-[#F5A623]/20 animate-float" />
        </div>

        <div className="relative w-full max-w-7xl mx-auto px-6 py-20 lg:py-0">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left content */}
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-[#F5A623]/20 text-[#E09000] px-4 py-2 rounded-full text-sm font-medium mb-8 opacity-0 animate-fade-up">
                <span className="w-2 h-2 bg-[#F5A623] rounded-full animate-pulse" />
                AI-Powered Habit Coaching
              </div>

              <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-[#1a1a1a] mb-6 leading-[1.1] opacity-0 animate-fade-up delay-100">
                Build habits
                <br />
                <span className="text-gradient">that actually</span>
                <br />
                stick.
              </h1>

              <p className="text-lg md:text-xl text-[#4a4a4a] max-w-lg mb-10 leading-relaxed opacity-0 animate-fade-up delay-200">
                Your personal AI coach that understands your goals, adapts to your rhythm, and celebrates every win with you.
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-4 opacity-0 animate-fade-up delay-300">
                <AppStoreButton />
                <a
                  href="#features"
                  className="group inline-flex items-center gap-2 px-6 py-4 text-[#4a4a4a] hover:text-[#1a1a1a] font-medium transition-colors"
                >
                  See how it works
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              </div>

              {/* Social proof */}
              <div className="mt-12 pt-8 border-t border-[#F5A623]/10 opacity-0 animate-fade-up delay-400">
                <div className="flex items-center gap-6">
                  <div className="flex -space-x-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="w-10 h-10 rounded-full border-2 border-[#FFFBF5] bg-gradient-to-br from-[#F5A623] to-[#E09000]"
                        style={{ opacity: 1 - i * 0.15 }}
                      />
                    ))}
                  </div>
                  <div className="text-sm">
                    <div className="font-semibold text-[#1a1a1a]">Join 2,000+ people</div>
                    <div className="text-[#7a7a7a]">building better habits</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right content - Phone */}
            <div className="order-1 lg:order-2 flex justify-center lg:justify-end opacity-0 animate-slide-in-right delay-200">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-32 bg-gradient-to-b from-[#FFFBF5] to-white">
        {/* Section decoration */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-20 bg-gradient-to-b from-transparent via-[#F5A623]/30 to-transparent" />

        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <span className="inline-block font-medium text-[#F5A623] mb-4 tracking-wide uppercase text-sm">Features</span>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#1a1a1a] mb-6">
              Everything you need to
              <br />
              <span className="text-gradient">transform your habits</span>
            </h2>
            <p className="text-lg text-[#4a4a4a] max-w-2xl mx-auto">
              Combining AI intelligence with proven behavioral science to help you build lasting change.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            <FeatureCard
              index={0}
              icon={
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              }
              title="Natural Conversations"
              description="Chat with your AI coach like you would a friend. Get personalized advice, encouragement, and accountability that adapts to your unique situation."
            />

            <FeatureCard
              index={1}
              icon={
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              }
              title="Voice Messages"
              description="Too busy to type? Send voice messages on the go and your coach responds naturally. Perfect for quick check-ins during your busy day."
            />

            <FeatureCard
              index={2}
              icon={
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              }
              title="Remembers Everything"
              description="Your coach builds a complete understanding of your history, struggles, and victories. Every conversation is informed by everything that came before."
            />

            <FeatureCard
              index={3}
              icon={
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title="Smart Reminders"
              description="Gentle nudges that adapt to your schedule and energy. Get reminded when you need it most, not when it's least convenient."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] via-[#2a2a2a] to-[#1a1a1a]" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 blob bg-[#F5A623]/20 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 blob-2 bg-[#F5A623]/10 blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <span className="inline-block font-medium text-[#F5A623] mb-4 tracking-wide uppercase text-sm">Get Started</span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Your best habits
            <br />
            are waiting.
          </h2>
          <p className="text-lg text-white/70 max-w-xl mx-auto mb-12">
            Join thousands who&apos;ve discovered the power of having a personal AI coach in their pocket.
          </p>
          <AppStoreButton variant="light" />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-[#FFFBF5] border-t border-[#F5A623]/10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F5A623] to-[#E09000] flex items-center justify-center shadow-lg shadow-[#F5A623]/20">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span className="font-display text-xl font-semibold text-[#1a1a1a]">Habits Coach</span>
            </div>

            <p className="text-[#7a7a7a] text-sm">
              © {new Date().getFullYear()} Capybara Studios. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
