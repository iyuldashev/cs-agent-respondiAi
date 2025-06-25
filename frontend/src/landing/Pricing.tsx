import React from 'react';
import { motion } from 'framer-motion';
import { 
  Check, 
  Star, 
  Users, 
  Building2, 
  Rocket,
  ArrowRight
} from 'lucide-react';

const plans = [
  {
    name: "Starter",
    icon: Users,
    price: "Free",
    description: "Perfect for small businesses getting started",
    features: [
      "Up to 100 conversations/month",
      "Basic AI responses",
      "Email support",
      "1 website integration",
      "Standard analytics"
    ],
    buttonText: "Get Started Free",
    buttonStyle: "border border-gray-600 text-white hover:border-green-500 hover:bg-green-500/10",
    popular: false
  },
  {
    name: "Professional",
    icon: Building2,
    price: "$29",
    period: "/month",
    description: "Best for growing businesses",
    features: [
      "Up to 2,000 conversations/month",
      "Advanced AI with memory",
      "Voice & text support",
      "Priority support",
      "5 website integrations",
      "Advanced analytics",
      "Custom branding",
      "API access"
    ],
    buttonText: "Start Free Trial",
    buttonStyle: "bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600",
    popular: true
  },
  {
    name: "Enterprise",
    icon: Rocket,
    price: "Custom",
    description: "For large organizations with specific needs",
    features: [
      "Unlimited conversations",
      "Custom AI training",
      "White-label solution",
      "24/7 phone support",
      "Unlimited integrations",
      "Custom analytics",
      "SSO & SAML",
      "Dedicated account manager",
      "SLA guarantee"
    ],
    buttonText: "Contact Sales",
    buttonStyle: "border border-gray-600 text-white hover:border-green-500 hover:bg-green-500/10",
    popular: false
  }
];

export default function Pricing() {
  return (
    <section className="py-24 bg-gray-800 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900/50 to-gray-800"></div>
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[800px] h-[800px] bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-full blur-3xl"></div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              viewport={{ once: true }}
              className="inline-flex items-center px-4 py-2 rounded-full border border-green-500/20 bg-green-500/10 text-green-400 text-sm font-medium mb-6"
            >
              <Star className="w-4 h-4 mr-2" />
              Simple Pricing
            </motion.div>

            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              Choose Your
              <span className="block bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                Perfect Plan
              </span>
            </h2>

            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Start free and scale as you grow. No hidden fees, no long-term contracts. 
              Cancel or upgrade anytime.
            </p>

            <div className="inline-flex items-center bg-gray-700 rounded-full p-1">
              <button className="px-6 py-2 rounded-full bg-green-500 text-white text-sm font-medium">
                Monthly
              </button>
              <button className="px-6 py-2 rounded-full text-gray-300 text-sm font-medium hover:text-white transition-colors">
                Annual (Save 20%)
              </button>
            </div>
          </motion.div>

          {/* Pricing Cards */}
          <div className="grid lg:grid-cols-3 gap-8 mb-16">
            {plans.map((plan, index) => {
              const Icon = plan.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                  viewport={{ once: true }}
                  className="relative"
                >
                  {/* Popular Badge */}
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                      <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                        Most Popular
                      </div>
                    </div>
                  )}

                  <div className={`relative bg-gray-900 border ${plan.popular ? 'border-green-500 shadow-2xl shadow-green-500/20' : 'border-gray-700'} rounded-2xl p-8 h-full hover:border-green-500/50 transition-all duration-300`}>
                    
                    {/* Plan Header */}
                    <div className="text-center mb-8">
                      <div className={`inline-flex items-center justify-center w-16 h-16 rounded-xl ${plan.popular ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gray-800'} mb-4`}>
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                      
                      <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                      <p className="text-gray-400 mb-4">{plan.description}</p>
                      
                      <div className="mb-6">
                        <span className="text-4xl font-bold text-white">{plan.price}</span>
                        {plan.period && <span className="text-gray-400">{plan.period}</span>}
                      </div>
                      
                      <button className={`w-full py-3 rounded-xl font-semibold transition-all duration-300 ${plan.buttonStyle}`}>
                        {plan.buttonText}
                      </button>
                    </div>

                    {/* Features List */}
                    <div className="space-y-4">
                      {plan.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-start">
                          <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-300">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* Background Glow */}
                    {plan.popular && (
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl -z-10"></div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Bottom Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <div className="bg-gradient-to-r from-gray-800 to-gray-700 border border-gray-600 rounded-2xl p-8 max-w-3xl mx-auto">
              <h3 className="text-2xl font-bold text-white mb-4">
                Need a Custom Solution?
              </h3>
              <p className="text-gray-300 mb-6">
                We work with large enterprises to create tailored AI solutions that fit your specific business needs and requirements.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 transition-all duration-300 flex items-center justify-center">
                  Schedule a Demo
                  <ArrowRight className="ml-2 w-4 h-4" />
                </button>
                <button className="border border-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:border-green-500 hover:bg-green-500/10 transition-all duration-300">
                  Contact Sales
                </button>
              </div>
            </div>

            <div className="mt-12 text-center text-gray-400">
              <p className="mb-4">Trusted by companies of all sizes</p>
              <div className="flex justify-center items-center space-x-8 opacity-60">
                <div className="text-2xl font-bold">Company A</div>
                <div className="text-2xl font-bold">Company B</div>
                <div className="text-2xl font-bold">Company C</div>
                <div className="text-2xl font-bold">Company D</div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}