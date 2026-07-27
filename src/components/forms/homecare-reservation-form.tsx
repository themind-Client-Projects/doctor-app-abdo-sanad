'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { User, Phone, MapPin, Syringe, Calendar, CheckCircle2 } from 'lucide-react';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/shared/forms/form';
import { Input } from '@/components/shared/forms/input';
import { Textarea } from '@/components/shared/forms/textarea';
import { Select } from '@/components/shared/forms/select';

const homecareSchema = z.object({
  fullName: z.string().min(3, { message: 'الاسم يجب أن يحتوي على 3 أحرف على الأقل' }),
  phone: z.string().regex(/^07[0-9]{8}$/, { message: 'رقم الهاتف غير صالح، يجب أن يتكون من 10 أرقام ويبدأ بـ 07' }),
  serviceType: z.string().min(1, { message: 'يرجى اختيار نوع الخدمة' }),
  date: z.string().min(1, { message: 'يرجى تحديد التاريخ' }),
  address: z.string().min(5, { message: 'يرجى كتابة العنوان بالتفصيل' }),
  notes: z.string().optional(),
  additionalServices: z.array(z.string()).optional(),
});

type HomecareFormValues = z.infer<typeof homecareSchema>;

interface HomecareReservationFormProps {
  centerName?: string;
  type?: 'nursing' | 'doctor';
  onSuccess?: () => void;
}

export function HomecareReservationForm({ centerName, type = 'nursing', onSuccess }: HomecareReservationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<HomecareFormValues>({
    resolver: zodResolver(homecareSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      serviceType: '',
      date: '',
      address: '',
      notes: '',
      additionalServices: [],
    },
  });

  const onSubmit = async (data: HomecareFormValues) => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    setIsSuccess(true);
    
    setTimeout(() => {
      if (onSuccess) onSuccess();
    }, 2000);
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">تم استلام طلبك بنجاح!</h3>
        <p className="text-gray-500 text-sm">سيتم التواصل معك قريباً لتأكيد الموعد {centerName ? `مع ${centerName}` : ''}</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 text-right">
        
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>اسم المريض الثلاثي</FormLabel>
              <FormControl>
                <Input placeholder="مثال: أحمد محمد علي" icon={<User className="w-5 h-5" />} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>رقم الهاتف للتواصل</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="07XX XXX XXXX" icon={<Phone className="w-5 h-5" />} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="serviceType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{type === 'nursing' ? 'نوع الخدمة المطلوبة' : 'التخصص الطبي المطلوب'}</FormLabel>
              <FormControl>
                <Select icon={<Syringe className="w-5 h-5" />} {...field}>
                  <option value="" disabled>
                    {type === 'nursing' ? 'اختر نوع الخدمة...' : 'اختر التخصص...'}
                  </option>
                  {type === 'nursing' ? (
                    <>
                      <option value="general">عناية تمريضية عامة</option>
                      <option value="iv">تركيب مغذيات وزرق إبر</option>
                      <option value="wound">تضميد جروح وعناية</option>
                      <option value="physio">علاج طبيعي منزلي</option>
                      <option value="lab">سحب عينات دم للتحاليل</option>
                    </>
                  ) : (
                    <>
                      <option value="gp">طبيب عام (باطنية)</option>
                      <option value="pediatric">طبيب أطفال</option>
                      <option value="ortho">طبيب عظام ومفاصل</option>
                      <option value="cardio">طبيب قلبية</option>
                      <option value="neuro">طبيب جملة عصبية</option>
                    </>
                  )}
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>تاريخ الزيارة المطلوب</FormLabel>
              <FormControl>
                <Input type="date" icon={<Calendar className="w-5 h-5" />} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>العنوان بالتفصيل</FormLabel>
              <FormControl>
                <Input placeholder="المنطقة، المحلة، الزقاق، الدار..." icon={<MapPin className="w-5 h-5" />} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ملاحظات إضافية (اختياري)</FormLabel>
              <FormControl>
                <Textarea placeholder="أية تفاصيل طبية أو إرشادات للوصول للمنزل..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Additional Services */}
        <div className="space-y-3 pt-2">
          <FormLabel>خدمات إضافية (اختياري)</FormLabel>
          <div className="space-y-2">
            {[
              { id: 'blood_sugar', name: 'فحص سكر الدم', price: 5000 },
              { id: 'blood_pressure', name: 'قياس ضغط الدم', price: 3000 },
              { id: 'oxygen', name: 'قياس نسبة الأوكسجين', price: 2000 },
            ].map(service => {
              const currentServices = form.watch('additionalServices') || [];
              const isSelected = currentServices.includes(service.id);
              
              return (
                <label key={service.id} className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-colors active:scale-[0.98] ${isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{service.name}</span>
                  </div>
                  <span className="text-sm font-bold text-primary">+{service.price.toLocaleString()} د.ع</span>
                  <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={isSelected}
                    onChange={(e) => {
                      const current = form.getValues('additionalServices') || [];
                      if (e.target.checked) {
                        form.setValue('additionalServices', [...current, service.id]);
                      } else {
                        form.setValue('additionalServices', current.filter(id => id !== service.id));
                      }
                    }}
                  />
                </label>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/30 transition-colors active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
        >
          {isSubmitting ? 'جاري إرسال الطلب...' : 'تأكيد الحجز'}
        </button>

        <div className="mt-6 pt-6 border-t border-gray-100 text-right text-xs text-gray-500 leading-relaxed">
          <p className="font-semibold text-gray-700 mb-3 text-sm">الرجاء العلم:</p>
          <ul className="list-disc list-inside space-y-2 opacity-90 marker:text-gray-400">
            <li>المنصة ليست منشأة طبية وإنما هي وسيط بين مقدمي الخدمة الصحية المرخصين والمرضى عن طريق موقعها الإلكتروني / تطبيقات الهاتف.</li>
            <li>لا تحل المنصة محل علاقة طبيب الرعاية الأولية الموجودة.</li>
            <li>تخضع الخدمات الطبية التي يقدمها مقدمي الخدمات الصحية لحكمهم المهني.</li>
            <li>لا تضمن المنصة كتابة وصفة طبية.</li>
            <li>لا يصف الأطباء ومقدمي الخدمات المواد الخاضعة للتحكم والأدوية المدرجة على الجداول المخدرة والأدوية غير العلاجية وبعض الأدوية الأخرى التي قد تكون ضارة بسبب احتمال إساءة استخدامها.</li>
            <li>جميع البيانات التي يتم جمعها من المرضى يتم استخدامها وفقاً للقوانين واللوائح للحفاظ على خصوصيتك.</li>
          </ul>
        </div>
      </form>
    </Form>
  );
}
