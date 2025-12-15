import { Map, Camera, BookText, Globe } from "lucide-react";
import Link from "next/link";

const Landing = () => {
  // const features = [
  //   {
  //     icon: Map,
  //     title: "Trace Your Footprints",
  //     description:
  //       "Pin every place you've visited and watch your travel history unfold on an interactive map.",
  //   },
  //   {
  //     icon: Camera,
  //     title: "Keep Your Memories",
  //     description:
  //       "Upload photos and notes so that every destination carries the moments that made it special.",
  //   },
  //   {
  //     icon: BookText,
  //     title: "Build Your Journals",
  //     description:
  //       "Organize your trips into beautiful journals that preserve your experiences forever.",
  //   },
  // ];

  return (
    <div className="min-h-screen bg-base-100">
      {/* Hero Section */}
      <section className="bg-primary relative pt-24 pb-20 min-h-screen flex items-center">
        <div className="container mx-auto px-6 sm:px-8">
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
            {/* Text Content */}
            <div className="bg-base-200 rounded-3xl p-8 sm:p-12 shadow-2xl space-y-8">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-serif font-bold leading-tight text-base-content">
                Leave Footprints,
                <span className="block text-accent mt-2">One at a Time</span>
              </h1>
              <p className="text-xl sm:text-2xl text-base-content/80 leading-relaxed">
                Track your trips, save your memories, and explore other users
                trips
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                <Link
                  href="/trips/add"
                  className="btn btn-accent btn-lg px-8 shadow-xl hover:scale-105 transition-transform"
                >
                  Start Your Journey
                </Link>
                <Link
                  href="/browse"
                  className="btn btn-outline border-2 border-accent text-accent hover:bg-accent/20 btn-lg px-8"
                >
                  Explore
                </Link>
              </div>
            </div>

            {/* Image */}
            <div className="relative">
              <div className="rounded-3xl overflow-hidden shadow-2xl">
                <img
                  src="/trent-bradley-l-eO8EasdMI-unsplash.jpg"
                  alt="Footprints in sand"
                  className="w-full h-[650px] object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section
      <section className="py-24 bg-base-100">
        <div className="container mx-auto px-6 sm:px-8">
          <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            {features.map((feature, index) => (
              <div key={index} className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10">
                  <feature.icon className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-base-content">
                  {feature.title}
                </h3>
                <p className="text-base-content/70 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section> */}

      {/* Footer */}
      <footer className="py-8 bg-base-200">
        <div className="container mx-auto px-6 text-center">
          <p className="text-base-content/60">© 2025 Footprints</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
