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
});

type HomecareFormValues = z.infer<typeof homecareSchema>;

interface HomecareReservationFormProps {
  centerName?: string;
  onSuccess?: () => void;
}

export function HomecareReservationForm({ centerName, onSuccess }: HomecareReservationFormProps) {
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
              <FormLabel>نوع الخدمة المطلوبة</FormLabel>
              <FormControl>
                <Select icon={<Syringe className="w-5 h-5" />} {...field}>
                  <option value="" disabled>اختر نوع الخدمة...</option>
                  <option value="general">عناية تمريضية عامة</option>
                  <option value="iv">تركيب مغذيات وزرق إبر</option>
                  <option value="wound">تضميد جروح وعناية</option>
                  <option value="physio">علاج طبيعي منزلي</option>
                  <option value="lab">سحب عينات دم للتحاليل</option>
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

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-rose-600/30 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
        >
          {isSubmitting ? 'جاري إرسال الطلب...' : 'تأكيد الحجز'}
        </button>
      </form>
    </Form>
  );
}
